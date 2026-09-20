import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { createHash } from 'node:crypto';
import {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_WINDOW_SECONDS,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from './auth.constants.js';
import { LoginAttempt } from './schemas/login-attempt.schema.js';

/**
 * Limite de tentativas de login: 5 falhas por 15 minutos, por IP e e-mail
 * combinados.
 *
 * A chave junta os dois de proposito. So por IP, um escritorio inteiro atras
 * do mesmo NAT se bloqueia junto; so por e-mail, qualquer um trava a conta da
 * dona de fora. Combinado, o bloqueio atinge a tentativa, nao a pessoa.
 */
@Injectable()
export class LoginRateLimitService {
  constructor(
    @InjectModel(LoginAttempt.name) private readonly attempts: Model<LoginAttempt>,
  ) {}

  /** Lanca 429 quando a janela ja acumulou o maximo de falhas. */
  async assertWithinLimit(ip: string, email: string): Promise<void> {
    const current = await this.attempts
      .findOne({ key: buildKey(ip, email), expiresAt: { $gt: new Date() } })
      .exec();

    if (current && current.attempts >= LOGIN_MAX_ATTEMPTS) {
      // Resposta generica: sem contador, sem tempo restante e sem dizer se o
      // que travou foi o e-mail ou o IP. Qualquer um desses numeros e uma
      // pista de que a conta existe.
      throw new HttpException(TOO_MANY_ATTEMPTS_MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** Conta mais uma falha. A janela comeca na primeira delas. */
  async registerFailure(ip: string, email: string): Promise<void> {
    const key = buildKey(ip, email);
    const now = new Date();

    const incremented = await this.attempts
      .updateOne({ key, expiresAt: { $gt: now } }, { $inc: { attempts: 1 } })
      .exec();

    if (incremented.matchedCount > 0) {
      return;
    }

    // Sem janela aberta: abre uma. O upsert tambem cobre o documento vencido
    // que o TTL ainda nao varreu — ele e reaproveitado com o contador zerado,
    // e nao somado ao da janela nova.
    await this.attempts
      .updateOne(
        { key },
        {
          $set: {
            attempts: 1,
            expiresAt: new Date(now.getTime() + LOGIN_WINDOW_SECONDS * 1000),
          },
        },
        { upsert: true },
      )
      .exec();
  }

  /** Login aceito: a janela daquela combinacao morre. */
  async clear(ip: string, email: string): Promise<void> {
    await this.attempts.deleteOne({ key: buildKey(ip, email) }).exec();
  }
}

function buildKey(ip: string, email: string): string {
  return createHash('sha256').update(`${ip}|${email.toLowerCase()}`).digest('hex');
}
