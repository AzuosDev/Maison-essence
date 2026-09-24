import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { BoxIcon } from '@/components/store';
import { ButtonLink } from '@/components/ui';
import styles from './account-invite.module.css';

export interface AccountInviteProps {
  /** O que esta atrás desta porta, dito como promessa e não como bloqueio. */
  title: string;
  description: string;
}

/**
 * O convite. **Não** e uma parede de login.
 *
 * ## A diferença, e por que ela decide o desenho
 *
 * Uma parede diz "você precisa entrar" e não deixa sair. Este componente diz
 * o contrário, em ordem: aqui e o que você ganha, estas são as duas portas,
 * e — a linha que nenhuma parede tem — **você não precisa de nada disso para
 * comprar**, com o caminho de volta a loja logo ao lado.
 *
 * Por isso a área da conta não redireciona ninguém. Quem digita
 * `/conta/pedidos` sem sessão continua em `/conta/pedidos`, lendo isto. Um
 * `<Navigate to="/conta/entrar">` seria a parede: trocaria o endereço que a
 * pessoa escolheu por um formulário que ela não pediu, e o botão "voltar" do
 * navegador a jogaria de novo no mesmo lugar.
 *
 * ## O que os botões levam junto
 *
 * O endereço atual, em `state.from`. Quem entra a partir daqui volta para a
 * tela que queria — não para uma página inicial de conta que não responde a
 * pergunta que o trouxe.
 *
 * ## A razão que convence de verdade
 *
 * Não e "acompanhe seus pedidos": e que **os pedidos feitos sem conta entram
 * na lista** quando a conta e criada com o mesmo telefone. Quem esta lendo
 * isto provavelmente já comprou aqui como convidado, e essa frase e a única
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
        Já comprou aqui sem conta? Crie a sua com o <strong>mesmo telefone</strong> do pedido e o
        histórico aparece junto.
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
        Comprar não exige conta nenhuma.{' '}
        <Link to={ROUTES.products} className={styles.escapeLink}>
          Voltar para a loja
        </Link>
      </p>
    </section>
  );
}
