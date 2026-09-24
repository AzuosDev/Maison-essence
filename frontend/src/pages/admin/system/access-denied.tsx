import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { ShieldIcon } from '@/components/admin';
import { ROLE_LABELS } from '@/features/admin';
import type { UserRole } from '@/features/auth';
import styles from './access-denied.module.css';

/**
 * A área existe e não e sua.
 *
 * ## Por que não e um 404 nem um erro
 *
 * Esconder a área do menu e a regra; mentir sobre a existência dela não e.
 * Quem chega aqui digitou `/admin/system` ou clicou num link que alguém
 * mandou, e em qualquer dos dois casos e uma pessoa autenticada, com conta
 * legitima, dentro do próprio painel. Um 404 a faria procurar um endereço
 * que não errou; um "algo deu errado" a faria recarregar a página três
 * vezes.
 *
 * O que ela precisa saber cabe em três frases: a área existe, e de outro
 * papel, e o caminho de volta e este botão. O papel dela aparece escrito
 * porque e a informação que resolve a dúvida seguinte — "mas eu não sou
 * administradora?" — sem precisar de uma conversa.
 *
 * ## Isto não e a proteção
 *
 * E a explicação. A proteção esta no `@Roles(...)` de cada controlador: sem
 * ela, esta tela seria apenas uma cortina, e as rotas de usuário
 * responderiam a qualquer um que soubesse chamar a API direto.
 */

export interface AccessDeniedProps {
  /** O papel de quem entrou. Ausente só entre o login e o `/auth/me`. */
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
