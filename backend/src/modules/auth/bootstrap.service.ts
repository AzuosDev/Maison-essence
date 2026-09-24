import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { USER_ROLES } from '../../common/enums/user-role.js';
import { AUDIT_ACTIONS, AUDIT_TARGETS, SYSTEM_ACTOR_ID } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditTarget } from '../audit/audit.types.js';
import type { Env } from '../../config/env.schema.js';
import { User } from '../users/schemas/user.schema.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import { toUserView } from '../users/user.view.js';
import type { UserView } from '../users/user.view.js';
import { PasswordService } from './password.service.js';

const DUPLICATE_KEY = 11000;

/** Como o pedido de bootstrap chegou. Vai para a trilha de auditoria. */
export const BOOTSTRAP_ORIGINS = {
  CLI: 'seed:superadmin',
  HTTP: 'POST /auth/bootstrap',
} as const;

export type BootstrapOrigin = (typeof BOOTSTRAP_ORIGINS)[keyof typeof BOOTSTRAP_ORIGINS];

/** Resposta da rota quando o banco já tem gente. Não diz quem. */
export const BOOTSTRAP_ALREADY_DONE_MESSAGE =
  'O banco já tem usuário: crie os próximos pelo painel.';

export const BOOTSTRAP_OUTCOMES = {
  CREATED: 'created',
  ALREADY_BOOTSTRAPPED: 'already-bootstrapped',
} as const;

export type BootstrapOutcome = (typeof BOOTSTRAP_OUTCOMES)[keyof typeof BOOTSTRAP_OUTCOMES];

export type BootstrapResult =
  | { outcome: typeof BOOTSTRAP_OUTCOMES.CREATED; user: UserView }
  | { outcome: typeof BOOTSTRAP_OUTCOMES.ALREADY_BOOTSTRAPPED; blockedBy: UserView };

export interface BootstrapOptions {
  origin: BootstrapOrigin;
  /**
   * `true` exige o banco sem usuário nenhum; `false` só exige que não exista
   * SUPER_ADMIN. E a única diferença entre a rota e o comando — ver `run`.
   */
  requireEmptyDatabase: boolean;
}

/** Faltam as variáveis do primeiro usuário. Não e erro de uso, e de ambiente. */
export class BootstrapNotConfiguredError extends Error {
  constructor(readonly missing: readonly string[]) {
    super(`Defina ${missing.join(' e ')} antes de criar o primeiro usuário.`);
    this.name = 'BootstrapNotConfiguredError';
  }
}

/**
 * Criação do primeiro SUPER_ADMIN.
 *
 * O painel não tem cadastro aberto: alguém precisa existir antes que o CRUD de
 * usuários sirva para alguma coisa. Este serviço e esse alguém, e vale para as
 * duas portas — `npm run seed:superadmin`, que e o caminho normal, e
 * `POST /auth/bootstrap`, que existe porque a Vercel não da shell.
 *
 * As duas portas param de funcionar assim que há administrador, mas com
 * critérios diferentes de propósito:
 *
 * - o comando roda na máquina de quem já tem a URI do banco na mão e só
 *   precisa ser idempotente: rodar duas vezes não cria dois super-admins;
 * - a rota fica exposta na internet, e ali "já existe SUPER_ADMIN" seria
 *   frouxo demais. Ela exige o banco **sem usuário nenhum**, o que a fecha
 *   para sempre no instante em que a loja tem o primeiro STAFF — mesmo que
 *   alguém esqueca o `BOOTSTRAP_SECRET` no ambiente.
 */
@Injectable()
export class BootstrapService {
  private readonly logger = new Logger('Bootstrap');

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {}

  /** `true` quando `BOOTSTRAP_SECRET` esta no ambiente. */
  get isHttpEnabled(): boolean {
    return Boolean(this.config.get('BOOTSTRAP_SECRET', { infer: true }));
  }

  async run(options: BootstrapOptions): Promise<BootstrapResult> {
    const input = this.readInput();
    const blocker = await this.findBlocker(options.requireEmptyDatabase);

    if (blocker) {
      return { outcome: BOOTSTRAP_OUTCOMES.ALREADY_BOOTSTRAPPED, blockedBy: toUserView(blocker) };
    }

    const created = await this.create(input);

    if (!created) {
      // Perdeu a corrida com outra chamada simultanea: o índice único de
      // e-mail derrubou este insert e o vencedor já esta no banco.
      const existing = await this.users.findOne({ email: input.email }).exec();

      if (!existing) {
        throw new Error('Falha ao criar o primeiro usuário.');
      }

      return { outcome: BOOTSTRAP_OUTCOMES.ALREADY_BOOTSTRAPPED, blockedBy: toUserView(existing) };
    }

    const party = partyOf(created);

    await this.audit.record({
      action: AUDIT_ACTIONS.USER_CREATED,
      // O ator e o próprio processo: não havia usuário para agir.
      actor: { id: SYSTEM_ACTOR_ID, email: options.origin, role: USER_ROLES.SUPER_ADMIN },
      target: party,
      details: { role: created.role, origin: options.origin },
    });

    this.logger.log(`Primeiro SUPER_ADMIN criado: ${created.email} (${options.origin})`);

    return { outcome: BOOTSTRAP_OUTCOMES.CREATED, user: toUserView(created) };
  }

  /** Lê as variáveis do primeiro usuário, dizendo quais faltam. */
  private readInput(): { name: string; email: string; password: string } {
    const email = this.config.get('BOOTSTRAP_SUPERADMIN_EMAIL', { infer: true });
    const password = this.config.get('BOOTSTRAP_SUPERADMIN_PASSWORD', { infer: true });
    const missing = [
      email ? undefined : 'BOOTSTRAP_SUPERADMIN_EMAIL',
      password ? undefined : 'BOOTSTRAP_SUPERADMIN_PASSWORD',
    ].filter((name): name is string => name !== undefined);

    if (!email || !password) {
      throw new BootstrapNotConfiguredError(missing);
    }

    return {
      name: this.config.get('BOOTSTRAP_SUPERADMIN_NAME', { infer: true }),
      email,
      password,
    };
  }

  private findBlocker(requireEmptyDatabase: boolean): Promise<UserDocument | null> {
    return this.users
      .findOne(requireEmptyDatabase ? {} : { role: USER_ROLES.SUPER_ADMIN })
      .sort({ createdAt: 1 })
      .exec();
  }

  /** Cria o usuário, ou `null` quando o e-mail já foi tomado na corrida. */
  private async create(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<UserDocument | null> {
    try {
      return await new this.users({
        name: input.name,
        email: input.email,
        passwordHash: await this.passwords.hash(input.password),
        role: USER_ROLES.SUPER_ADMIN,
        isActive: true,
        // A senha esta em texto numa variável de ambiente, que fica visível
        // no painel da Vercel e no histórico do shell. Ela serve para entrar
        // uma vez e ser trocada.
        mustChangePassword: true,
      }).save();
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        return null;
      }

      throw error;
    }
  }
}

function partyOf(user: UserDocument): AuditTarget {
  return { kind: AUDIT_TARGETS.USER, id: user._id.toHexString(), label: user.email };
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
