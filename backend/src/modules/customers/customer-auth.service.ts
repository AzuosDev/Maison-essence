import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { Order } from '../../schemas.js';
import {
  CUSTOMER_ACCESS_TOKEN_TTL_SECONDS,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_MIN_DURATION_MS,
} from '../auth/auth.constants.js';
import { withMinimumDuration } from '../auth/constant-time.js';
import { PasswordService } from '../auth/password.service.js';
import { RefreshTokenService, customerOwner } from '../auth/refresh-token.service.js';
import { TOKEN_AUDIENCES } from '../auth/auth.types.js';
import { TokenService } from '../auth/token.service.js';
import { DeliveryCity } from '../delivery/schemas/delivery-city.schema.js';
import { citiesOf, planAddresses } from './customer-addresses.js';
import type { CustomerSession, CustomerView } from './customer.view.js';
import { toCustomerView } from './customer.view.js';
import {
  CUSTOMER_NOT_FOUND_MESSAGE,
  EMAIL_TAKEN_MESSAGE,
  PHONE_TAKEN_MESSAGE,
  UNKNOWN_CITY_MESSAGE,
  unknownAddressesMessage,
} from './customers.constants.js';
import type { CustomerAddressDto } from './dto/update-customer.dto.js';
import type { RegisterCustomerDto } from './dto/register-customer.dto.js';
import type { LoginCustomerDto } from './dto/login-customer.dto.js';
import type { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { Customer } from './schemas/customer.schema.js';
import type { CustomerDocument } from './schemas/customer.schema.js';

const DUPLICATE_KEY = 11000;

/** De onde veio a chamada. Alimenta o registro da sessão. */
export interface CustomerRequestContext {
  userAgent: string;
}

/**
 * Contas de cliente da loja.
 *
 * A conta e opcional por desenho: existe para quem quer acompanhar os próprios
 * pedidos e reaproveitar o endereço, e nada no checkout a exige. Por isso o
 * cadastro não e uma porta de entrada — e uma porta lateral, aberta depois,
 * para um histórico que já existe.
 *
 * Reaproveita inteira a mecânica do painel: o mesmo `PasswordService`, o mesmo
 * `TokenService` e a mesma rotação de refresh com detecção de reuso. O que
 * muda e o que precisa mudar — segredo, audiência, tempo de vida e a coleção
 * consultada —, e nada disso e decidido aqui: vem do `TOKEN_AUDIENCES.CUSTOMER`
 * que estas chamadas carregam.
 */
@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @InjectModel(Customer.name) private readonly customers: Model<Customer>,
    @InjectModel(Order.name) private readonly orders: Model<Order>,
    @InjectModel(DeliveryCity.name) private readonly cities: Model<DeliveryCity>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: RefreshTokenService,
  ) {}

  /**
   * Cria a conta e adota os pedidos que aquele telefone já tinha feito.
   *
   * Telefone repetido responde 409 dizendo o que houve, ao contrário do login,
   * que nunca explica nada: aqui não há o que esconder — quem esta na tela
   * acabou de digitar o próprio número — e mandar essa pessoa para o login e a
   * única saída útil.
   */
  async register(
    dto: RegisterCustomerDto,
    context: CustomerRequestContext,
  ): Promise<CustomerSession> {
    const customer = new this.customers({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
    });

    const saved = await this.save(customer);
    const adopted = await this.adoptGuestOrders(saved);

    this.logger.log(
      `Conta de cliente criada (${saved._id.toHexString()}): ` +
        `${adopted} pedido(s) anterior(es) vinculado(s)`,
    );

    return this.issueSession(saved, context);
  }

  /**
   * Login por telefone e senha.
   *
   * Todo caminho de recusa — telefone sem conta, senha errada, conta
   * desativada — devolve o mesmo 401 e demora o mesmo tanto, como no painel.
   * A diferença e que aqui o oráculo seria pior: descobrir quais telefones
   * tem conta na loja e descobrir quem comprou.
   */
  login(dto: LoginCustomerDto, context: CustomerRequestContext): Promise<CustomerSession> {
    return withMinimumDuration(LOGIN_MIN_DURATION_MS, async () => {
      // `+passwordHash`: o campo e `select: false` no schema e só o login o pede.
      const customer = await this.customers
        .findOne({ phone: dto.phone })
        .select('+passwordHash')
        .exec();
      const matches = await this.passwords.verify(customer?.passwordHash, dto.password);

      if (!customer || !matches || !customer.isActive) {
        throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
      }

      const lastLoginAt = new Date();

      await this.customers.updateOne({ _id: customer._id }, { $set: { lastLoginAt } }).exec();
      customer.lastLoginAt = lastLoginAt;

      /**
       * A adoção roda em todo login, e não só no cadastro.
       *
       * O cliente com conta também compra deslogado — e o caminho padrão da
       * loja, e o mais rápido. Sem isso, o pedido que ele fez no celular sem
       * entrar nunca apareceria no histórico, e o telefone e a mesma chave nos
       * dois casos. Custa um `updateMany` filtrado por índice, e só encontra
       * algo quando há algo a encontrar.
       */
      await this.adoptGuestOrders(customer);

      return this.issueSession(customer, context);
    });
  }

  /**
   * Troca um refresh token da loja por um par novo.
   *
   * A rotação e a detecção de reuso acontecem em `RefreshTokenService.claim`,
   * o mesmo do painel, com a audiência da loja. Aqui fica só o que depende da
   * conta: quem foi desativado entre uma renovação e outra perde todas as
   * sessões em vez de ganhar um token novo.
   */
  async refresh(rawToken: string, context: CustomerRequestContext): Promise<CustomerSession> {
    const claimed = await this.sessions.claim(rawToken, TOKEN_AUDIENCES.CUSTOMER);
    const customer = await this.customers.findById(claimed.ownerId).exec();

    if (!customer || !customer.isActive) {
      await this.sessions.revokeAllSessions(customerOwner(claimed.ownerId));

      throw new UnauthorizedException('Sessão inválida.');
    }

    return this.issueSession(customer, context, claimed.tokenId);
  }

  /** A conta inteira, com os endereços salvos. */
  async profile(customerId: string): Promise<CustomerView> {
    return toCustomerView(await this.findById(customerId));
  }

  /**
   * Edita a própria conta.
   *
   * Campo ausente fica como esta; `addresses`, quando vem, substitui a lista
   * inteira — e a forma que o formulário de endereços usa, e a única que
   * permite remover um endereço sem uma rota só para isso.
   */
  async update(customerId: string, dto: UpdateCustomerDto): Promise<CustomerView> {
    const customer = await this.findById(customerId);

    if (dto.name !== undefined) {
      customer.name = dto.name;
    }

    if (dto.email !== undefined) {
      customer.email = dto.email;
    }

    if (dto.addresses !== undefined) {
      customer.set('addresses', await this.plannedAddresses(customer, dto.addresses));
    }

    return toCustomerView(await this.save(customer));
  }

  /**
   * Liga a esta conta os pedidos feitos como convidado com o mesmo telefone.
   *
   * O telefone e a chave natural: foi o que o cliente informou no checkout e e
   * o que a dona usa para responder. Um pedido que já pertence a alguma conta
   * nunca e tocado — o filtro exige `customerId: null` —, então a operação e
   * idempotente e não tem como roubar o histórico de outra conta.
   */
  private async adoptGuestOrders(customer: CustomerDocument): Promise<number> {
    const result = await this.orders
      .updateMany(
        { 'customer.phone': customer.phone, customerId: null },
        { $set: { customerId: customer._id } },
      )
      .exec();

    return result.modifiedCount;
  }

  /**
   * A lista de endereços pronta para gravar.
   *
   * O `_id` de cada endereço e preservado quando o formulário manda o `id`:
   * corrigir o número da casa não pode fazer o endereço trocar de identidade,
   * porque e por ela que a tela sabe qual cartão editar. Endereço sem `id` e
   * novo e ganha o seu.
   */
  private async plannedAddresses(
    customer: CustomerDocument,
    incoming: readonly CustomerAddressDto[],
  ): Promise<Record<string, unknown>[]> {
    const plan = planAddresses(
      incoming,
      customer.addresses.map((address) => address.id),
    );

    if (plan.unknown.length > 0) {
      throw new ConflictException(unknownAddressesMessage(plan.unknown));
    }

    await this.assertCitiesAreServed(incoming);

    return plan.addresses;
  }

  /**
   * Nenhum endereço pode apontar para cidade que a loja não atende.
   *
   * A conferência acontece na gravação, e não na leitura: a cidade pode ser
   * desativada depois, e um endereço salvo que deixou de ser atendido continua
   * sendo o endereço da pessoa — quem recusa a entrega e o fechamento do
   * pedido, com a mensagem certa, e não a tela de cadastro.
   */
  private async assertCitiesAreServed(
    addresses: readonly CustomerAddressDto[],
  ): Promise<void> {
    const ids = citiesOf(addresses);

    if (ids.length === 0) {
      return;
    }

    const served = await this.cities
      .countDocuments({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        isActive: true,
      })
      .exec();

    if (served !== ids.length) {
      throw new ConflictException(UNKNOWN_CITY_MESSAGE);
    }
  }

  private async issueSession(
    customer: CustomerDocument,
    context: CustomerRequestContext,
    replaces?: Types.ObjectId,
  ): Promise<CustomerSession> {
    const [accessToken, refresh] = await Promise.all([
      this.tokens.signCustomerAccessToken({
        id: customer._id.toHexString(),
        credentialVersion: customer.credentialVersion,
      }),
      this.sessions.issue(customerOwner(customer._id), context.userAgent, replaces),
    ]);

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: CUSTOMER_ACCESS_TOKEN_TTL_SECONDS,
      tokenType: 'Bearer',
      customer: toCustomerView(customer),
    };
  }

  private async findById(customerId: string): Promise<CustomerDocument> {
    const found = Types.ObjectId.isValid(customerId)
      ? await this.customers.findById(new Types.ObjectId(customerId)).exec()
      : null;

    if (!found) {
      // O token e válido e a conta sumiu: só acontece se ela for removida no
      // meio de uma sessão.
      throw new UnauthorizedException(CUSTOMER_NOT_FOUND_MESSAGE);
    }

    return found;
  }

  /** Salva traduzindo as colisões de telefone e e-mail em 409. */
  private async save(customer: CustomerDocument): Promise<CustomerDocument> {
    try {
      return await customer.save();
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        throw new ConflictException(
          duplicatedField(error) === 'email' ? EMAIL_TAKEN_MESSAGE : PHONE_TAKEN_MESSAGE,
        );
      }

      throw error;
    }
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === DUPLICATE_KEY
  );
}

/** O campo que colidiu, lido do erro do Mongo. */
function duplicatedField(error: unknown): string {
  const pattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};

  return Object.keys(pattern)[0] ?? '';
}
