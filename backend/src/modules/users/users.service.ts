import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { USER_ROLES } from '../../common/enums/user-role.js';
import { USER_AUDIT_ACTIONS, UserAuditLog } from '../../common/user-audit.log.js';
import type { AuditParty } from '../../common/user-audit.log.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PasswordService } from '../auth/password.service.js';
import { RefreshTokenService } from '../auth/refresh-token.service.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { User } from './schemas/user.schema.js';
import type { UserDocument } from './schemas/user.schema.js';
import {
  USER_NOT_FOUND_MESSAGE,
  assertCanAssignRole,
  assertCanEditProfile,
  assertCanManage,
  assertNotOwnRole,
  visibilityFilter,
} from './user-access.policy.js';
import { toUserView } from './user.view.js';
import type { UserView } from './user.view.js';

const DUPLICATE_KEY = 11000;

export const EMAIL_TAKEN_MESSAGE = 'Ja existe um usuario com esse e-mail.';
export const SELF_DEACTIVATION_MESSAGE = 'Voce nao pode desativar a si mesmo.';
export const LAST_SUPER_ADMIN_MESSAGE =
  'Este e o ultimo SUPER_ADMIN ativo: promova outro antes de mexer neste.';

/** Senha temporaria devolvida uma unica vez, na resposta do reset. */
export interface PasswordResetResult {
  user: UserView;
  temporaryPassword: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly passwords: PasswordService,
    private readonly sessions: RefreshTokenService,
    private readonly audit: UserAuditLog,
  ) {}

  /** Lista o que o ator enxerga. Para o OWNER, SUPER_ADMIN nao existe. */
  async list(actor: AuthenticatedUser): Promise<UserView[]> {
    const found = await this.users
      .find(visibilityFilter(actor))
      .sort({ name: 1 })
      .exec();

    return found.map(toUserView);
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto): Promise<UserView> {
    assertCanAssignRole(actor, dto.role);
    await this.assertEmailIsFree(dto.email);

    const created = await this.save(
      new this.users({
        name: dto.name,
        email: dto.email,
        passwordHash: await this.passwords.hash(dto.temporaryPassword),
        role: dto.role,
        isActive: true,
        // Nasce pendente: quem criou digitou a senha e portanto a conhece.
        mustChangePassword: true,
      }),
    );

    this.audit.record({
      action: USER_AUDIT_ACTIONS.CREATED,
      actor: toParty(actor),
      target: partyOf(created),
      details: { role: created.role },
    });

    return toUserView(created);
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserView> {
    const target = await this.findForActor(id);

    assertCanEditProfile(actor, viewTarget(target));

    const changed: Record<string, unknown> = {};

    if (dto.name !== undefined && dto.name !== target.name) {
      target.name = dto.name;
      changed.name = dto.name;
    }

    if (dto.email !== undefined && dto.email !== target.email) {
      await this.assertEmailIsFree(dto.email, target._id);
      target.email = dto.email;
      changed.email = dto.email;
    }

    if (dto.role !== undefined && dto.role !== target.role) {
      // Mudar papel e gerenciar, nao editar perfil: exige alcance sobre o
      // alvo mesmo quando o alvo e o proprio ator.
      assertCanManage(actor, viewTarget(target));
      assertNotOwnRole(actor, viewTarget(target));
      assertCanAssignRole(actor, dto.role);

      if (target.role === USER_ROLES.SUPER_ADMIN) {
        await this.assertNotLastSuperAdmin(target._id);
      }

      changed.role = { de: target.role, para: dto.role };
      target.role = dto.role;
    }

    if (Object.keys(changed).length === 0) {
      throw new BadRequestException('Nada para alterar.');
    }

    const saved = await this.save(target);

    // Papel novo precisa valer agora: o antigo esta dentro do access token
    // que o usuario tem na mao. A sessao continua de pe e a proxima renovacao
    // ja sai com o papel correto.
    if (changed.role) {
      await this.sessions.bumpCredentialVersion(saved._id);
    }

    this.audit.record({
      action: USER_AUDIT_ACTIONS.UPDATED,
      actor: toParty(actor),
      target: partyOf(saved),
      details: changed,
    });

    return toUserView(saved);
  }

  /**
   * Ativa ou desativa. Desativar revoga as sessoes na hora — e o que faz o
   * usuario cair na proxima chamada, e nao quando o token dele expirar.
   */
  async setStatus(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateUserStatusDto,
  ): Promise<UserView> {
    const target = await this.findForActor(id);

    assertCanManage(actor, viewTarget(target));

    if (!dto.isActive) {
      if (actor.id === target._id.toHexString()) {
        throw new ConflictException(SELF_DEACTIVATION_MESSAGE);
      }

      if (target.role === USER_ROLES.SUPER_ADMIN) {
        await this.assertNotLastSuperAdmin(target._id);
      }
    }

    if (target.isActive === dto.isActive) {
      return toUserView(target);
    }

    target.isActive = dto.isActive;

    const saved = await this.save(target);

    if (!dto.isActive) {
      await this.sessions.revokeAllSessions(saved._id);
    }

    this.audit.record({
      action: dto.isActive
        ? USER_AUDIT_ACTIONS.ACTIVATED
        : USER_AUDIT_ACTIONS.DEACTIVATED,
      actor: toParty(actor),
      target: partyOf(saved),
    });

    return toUserView(saved);
  }

  /**
   * Gera uma senha temporaria nova, marca a troca como obrigatoria e derruba
   * todas as sessoes do alvo: quem quer que estivesse usando a senha antiga
   * — inclusive quem a roubou — perde o acesso na mesma operacao.
   *
   * A senha volta em texto uma unica vez, nesta resposta. Nao ha como
   * recupera-la depois, e e por isso que ela nao vai para o log.
   */
  async resetPassword(actor: AuthenticatedUser, id: string): Promise<PasswordResetResult> {
    const target = await this.findForActor(id);

    assertCanManage(actor, viewTarget(target));

    const temporaryPassword = this.passwords.generateTemporary();

    target.passwordHash = await this.passwords.hash(temporaryPassword);
    target.mustChangePassword = true;

    const saved = await this.save(target);

    await this.sessions.revokeAllSessions(saved._id);

    this.audit.record({
      action: USER_AUDIT_ACTIONS.PASSWORD_RESET,
      actor: toParty(actor),
      target: partyOf(saved),
    });

    return { user: toUserView(saved), temporaryPassword };
  }

  /** Busca pelo id, tratando id malformado como "nao encontrado". */
  private async findForActor(id: string): Promise<UserDocument> {
    const found = Types.ObjectId.isValid(id)
      ? await this.users.findById(new Types.ObjectId(id)).exec()
      : null;

    if (!found) {
      throw new NotFoundException(USER_NOT_FOUND_MESSAGE);
    }

    return found;
  }

  private async assertEmailIsFree(email: string, exceptId?: Types.ObjectId): Promise<void> {
    const existing = await this.users.findOne({ email }).select('_id').exec();

    if (existing && !existing._id.equals(exceptId)) {
      throw new ConflictException(EMAIL_TAKEN_MESSAGE);
    }
  }

  /**
   * O sistema nunca pode ficar sem administrador.
   *
   * Conferir e depois gravar tem uma janela teorica de corrida — dois
   * SUPER_ADMIN se desativando no mesmo instante. Com duas ou tres contas no
   * painel isso nao acontece, e a alternativa (transacao) exige replica set,
   * que o Atlas M0 nao garante.
   */
  private async assertNotLastSuperAdmin(exceptId: Types.ObjectId): Promise<void> {
    const remaining = await this.users
      .countDocuments({
        _id: { $ne: exceptId },
        role: USER_ROLES.SUPER_ADMIN,
        isActive: true,
      })
      .exec();

    if (remaining === 0) {
      throw new ConflictException(LAST_SUPER_ADMIN_MESSAGE);
    }
  }

  /** Salva traduzindo a colisao do indice unico de e-mail em 409. */
  private async save(user: UserDocument): Promise<UserDocument> {
    try {
      return await user.save();
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        throw new ConflictException(EMAIL_TAKEN_MESSAGE);
      }

      throw error;
    }
  }
}

function viewTarget(user: UserDocument): { id: string; role: UserDocument['role'] } {
  return { id: user._id.toHexString(), role: user.role };
}

function toParty(actor: AuthenticatedUser): AuditParty {
  return { id: actor.id, email: actor.email, role: actor.role };
}

function partyOf(user: UserDocument): AuditParty {
  return { id: user._id.toHexString(), email: user.email, role: user.role };
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}
