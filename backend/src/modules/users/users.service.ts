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
import { AUDIT_ACTIONS, AUDIT_TARGETS } from '../audit/audit.constants.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuditActor, AuditTarget } from '../audit/audit.types.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PasswordService } from '../auth/password.service.js';
import { RefreshTokenService, adminOwner } from '../auth/refresh-token.service.js';
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

export const EMAIL_TAKEN_MESSAGE = 'Já existe um usuário com esse e-mail.';
export const SELF_DEACTIVATION_MESSAGE = 'Você não pode desativar a si mesmo.';
export const LAST_SUPER_ADMIN_MESSAGE =
  'Este e o último SUPER_ADMIN ativo: promova outro antes de mexer neste.';

/** Senha temporária devolvida uma única vez, na resposta do reset. */
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
    private readonly audit: AuditService,
  ) {}

  /** Lista o que o ator enxerga. Para o OWNER, SUPER_ADMIN não existe. */
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

    await this.audit.record({
      action: AUDIT_ACTIONS.USER_CREATED,
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
      // Mudar papel e gerenciar, não editar perfil: exige alcance sobre o
      // alvo mesmo quando o alvo e o próprio ator.
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
    // que o usuário tem na mão. A sessão continua de pé e a próxima renovação
    // já sai com o papel correto.
    if (changed.role) {
      await this.sessions.bumpCredentialVersion(adminOwner(saved._id));
    }

    await this.audit.record({
      action: AUDIT_ACTIONS.USER_UPDATED,
      actor: toParty(actor),
      target: partyOf(saved),
      details: changed,
    });

    return toUserView(saved);
  }

  /**
   * Ativa ou desativa. Desativar revoga as sessões na hora — e o que faz o
   * usuário cair na próxima chamada, e não quando o token dele expirar.
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
      await this.sessions.revokeAllSessions(adminOwner(saved._id));
    }

    await this.audit.record({
      action: dto.isActive
        ? AUDIT_ACTIONS.USER_ACTIVATED
        : AUDIT_ACTIONS.USER_DEACTIVATED,
      actor: toParty(actor),
      target: partyOf(saved),
    });

    return toUserView(saved);
  }

  /**
   * Gera uma senha temporária nova, marca a troca como obrigatória e derruba
   * todas as sessões do alvo: quem quer que estivesse usando a senha antiga
   * — inclusive quem a roubou — perde o acesso na mesma operação.
   *
   * A senha volta em texto uma única vez, nesta resposta. Não há como
   * recupera-lá depois, e e por isso que ela não vai para o log.
   */
  async resetPassword(actor: AuthenticatedUser, id: string): Promise<PasswordResetResult> {
    const target = await this.findForActor(id);

    assertCanManage(actor, viewTarget(target));

    const temporaryPassword = this.passwords.generateTemporary();

    target.passwordHash = await this.passwords.hash(temporaryPassword);
    target.mustChangePassword = true;

    const saved = await this.save(target);

    await this.sessions.revokeAllSessions(adminOwner(saved._id));

    await this.audit.record({
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      actor: toParty(actor),
      target: partyOf(saved),
    });

    return { user: toUserView(saved), temporaryPassword };
  }

  /** Busca pelo id, tratando id malformado como "não encontrado". */
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
   * Conferir e depois gravar tem uma janela teórica de corrida — dois
   * SUPER_ADMIN se desativando no mesmo instante. Com duas ou três contas no
   * painel isso não acontece, e a alternativa (transação) exige replica set,
   * que o Atlas M0 não garante.
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

  /** Salva traduzindo a colisão do índice único de e-mail em 409. */
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

function toParty(actor: AuthenticatedUser): AuditActor {
  return { id: actor.id, email: actor.email, role: actor.role };
}

/** O usuário como alvo da ação: o e-mail e o rótulo que se reconhece. */
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
