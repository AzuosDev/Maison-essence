import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { ShieldIcon } from '@/components/admin';
import { ROLE_LABELS } from '@/features/admin';
import type { UserRole } from '@/features/auth';
import styles from './access-denied.module.css';

/**
 * A area existe e nao e sua.
 *
 * ## Por que nao e um 404 nem um erro
 *
 * Esconder a area do menu e a regra; mentir sobre a existencia dela nao e.
 * Quem chega aqui digitou `/admin/system` ou clicou num link que alguem
 * mandou, e em qualquer dos dois casos e uma pessoa autenticada, com conta
 * legitima, dentro do proprio painel. Um 404 a faria procurar um endereco
 * que nao errou; um "algo deu errado" a faria recarregar a pagina tres
 * vezes.
 *
 * O que ela precisa saber cabe em tres frases: a area existe, e de outro
 * papel, e o caminho de volta e este botao. O papel dela aparece escrito
 * porque e a informacao que resolve a duvida seguinte — "mas eu nao sou
 * administradora?" — sem precisar de uma conversa.
 *
 * ## Isto nao e a protecao
 *
 * E a explicacao. A protecao esta no `@Roles(...)` de cada controlador: sem
 * ela, esta tela seria apenas uma cortina, e as rotas de usuario
 * responderiam a qualquer um que soubesse chamar a API direto.
 */

export interface AccessDeniedProps {
  /** O papel de quem entrou. Ausente so entre o login e o `/auth/me`. */
  role: UserRole | undefined;
}

export function AccessDenied({ role }: AccessDeniedProps) {
  return (
    <section className={styles.box}>
      <ShieldIcon className={styles.icon} />

      <h1 className={styles.title}>Esta área e do administrador do sistema</h1>

      <p className={styles.body}>
        Aqui ficam as contas de acesso, a trilha de auditoria e a saúde do servidor.
        {role === undefined
          ? ' Seu papel não abre esta área.'
          : ` Seu papel no painel e ${ROLE_LABELS[role].toLowerCase()}, e ele não abre esta área.`}
      </p>

      <p className={styles.body}>
        Se você precisa de alguma coisa daqui — criar um acesso para quem vai ajudar no atendimento,
        por exemplo —, fale com quem mantem o sistema.
      </p>

      <Link to={ROUTES.admin.root} className={styles.back}>
        Voltar para o início do painel
      </Link>
    </section>
  );
}
