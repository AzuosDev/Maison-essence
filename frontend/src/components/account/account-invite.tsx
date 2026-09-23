import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { BoxIcon } from '@/components/store';
import { ButtonLink } from '@/components/ui';
import styles from './account-invite.module.css';

export interface AccountInviteProps {
  /** O que esta atras desta porta, dito como promessa e nao como bloqueio. */
  title: string;
  description: string;
}

/**
 * O convite. **Nao** e uma parede de login.
 *
 * ## A diferenca, e por que ela decide o desenho
 *
 * Uma parede diz "voce precisa entrar" e nao deixa sair. Este componente diz
 * o contrario, em ordem: aqui e o que voce ganha, estas sao as duas portas,
 * e — a linha que nenhuma parede tem — **voce nao precisa de nada disso para
 * comprar**, com o caminho de volta a loja logo ao lado.
 *
 * Por isso a area da conta nao redireciona ninguem. Quem digita
 * `/conta/pedidos` sem sessao continua em `/conta/pedidos`, lendo isto. Um
 * `<Navigate to="/conta/entrar">` seria a parede: trocaria o endereco que a
 * pessoa escolheu por um formulario que ela nao pediu, e o botao "voltar" do
 * navegador a jogaria de novo no mesmo lugar.
 *
 * ## O que os botoes levam junto
 *
 * O endereco atual, em `state.from`. Quem entra a partir daqui volta para a
 * tela que queria — nao para uma pagina inicial de conta que nao responde a
 * pergunta que o trouxe.
 *
 * ## A razao que convence de verdade
 *
 * Nao e "acompanhe seus pedidos": e que **os pedidos feitos sem conta entram
 * na lista** quando a conta e criada com o mesmo telefone. Quem esta lendo
 * isto provavelmente ja comprou aqui como convidado, e essa frase e a unica
 * que transforma um cadastro em algo que devolve alguma coisa na hora.
 */
export function AccountInvite({ title, description }: AccountInviteProps) {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;

  return (
    <section className={styles.invite} aria-labelledby="account-invite-title">
      <span className={styles.mark} aria-hidden="true">
        <BoxIcon width="28" height="28" />
      </span>

      <h1 id="account-invite-title" className={styles.title}>
        {title}
      </h1>

      <p className={styles.description}>{description}</p>

      <p className={styles.adoption}>
        Ja comprou aqui sem conta? Crie a sua com o <strong>mesmo telefone</strong> do pedido e o
        historico aparece junto.
      </p>

      <div className={styles.actions}>
        <ButtonLink to={ROUTES.account.login} state={{ from }}>
          Entrar
        </ButtonLink>

        <ButtonLink to={ROUTES.account.register} state={{ from }} variant="secondary">
          Criar minha conta
        </ButtonLink>
      </div>

      <p className={styles.escape}>
        Comprar nao exige conta nenhuma.{' '}
        <Link to={ROUTES.products} className={styles.escapeLink}>
          Voltar para a loja
        </Link>
      </p>
    </section>
  );
}
