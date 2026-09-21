import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { currentRequestId } from '../../common/request-context.js';
import { REDACTED_AUDIT_KEY, REDACTED_VALUE } from './audit.constants.js';
import type { AuditEntryInput } from './audit.types.js';
import { AuditEntry } from './schemas/audit-entry.schema.js';

/**
 * A trilha de auditoria das acoes sensiveis do painel.
 *
 * Escreve nos dois lugares de proposito: a colecao, que sobrevive a retencao
 * de log do provedor e responde "quem mudou esse preco em marco?", e a linha
 * de log, que e onde a pessoa que esta investigando um incidente agora ja esta
 * olhando. As duas carregam o mesmo `requestId`, entao a entrada da trilha e
 * as linhas da mesma requisicao se encontram.
 *
 * `record` nunca lanca. A acao auditada ja aconteceu quando a trilha e
 * escrita — a senha ja foi trocada, o preco ja mudou —, e derrubar a resposta
 * por causa do registro transformaria uma falha de escrita secundaria em erro
 * na cara de quem usa o painel, sem desfazer nada. A falha vai para o log como
 * erro, que e onde ela pode ser vista.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(@InjectModel(AuditEntry.name) private readonly entries: Model<AuditEntry>) {}

  async record(entry: AuditEntryInput): Promise<void> {
    const document = {
      action: entry.action,
      actorId: entry.actor.id,
      actorEmail: entry.actor.email,
      actorRole: entry.actor.role ?? null,
      targetKind: entry.target?.kind ?? null,
      targetId: entry.target?.id ?? '',
      targetLabel: entry.target?.label ?? '',
      changes: redactValues(entry.changes),
      details: redactValues(entry.details),
      requestId: currentRequestId() ?? '',
    };

    this.logger.log(JSON.stringify(document));

    try {
      await this.entries.create(document);
    } catch (error: unknown) {
      this.logger.error(
        `Falha ao gravar a auditoria de ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

/**
 * Esconde o valor de qualquer campo cujo nome cheire a segredo, em qualquer
 * profundidade.
 *
 * E a segunda rede, nao a primeira: quem monta a entrada ja e responsavel por
 * nao colocar segredo nela (a chave PIX, por exemplo, chega aqui mascarada da
 * origem). Esta existe para o `details` que alguem acrescentar daqui a um ano
 * sem lembrar da regra.
 */
function redactValues<T extends Record<string, unknown> | undefined>(
  value: T,
): Record<string, unknown> | null {
  if (value === undefined) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      REDACTED_AUDIT_KEY.test(key) ? REDACTED_VALUE : redactDeep(inner),
    ]),
  );
}

function redactDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactDeep);
  }

  if (typeof value === 'object' && value !== null) {
    return redactValues(value as Record<string, unknown>);
  }

  return value;
}
