import type { ReactNode } from 'react';
import { AlertIcon } from './admin-icons';
import styles from './missing-route.module.css';

/**
 * A tela funciona; a rota que ela chama ainda não existe.
 *
 * ## Por que isto e um componente, e não um erro genérico
 *
 * Três telas da área de sistema chamam rotas que o backend não publica: a
 * trilha de auditoria (`GET /audit`), a contagem por coleção e o seed de
 * demonstração. O módulo de auditoria, por exemplo, tem serviço, coleção e
 * dois anos de retenção — só não tem controlador.
 *
 * "Algo deu errado. Tente novamente em instantes." seria mentira nos três
 * casos: não há nada de errado e tentar de novo não muda nada. Quem abre
 * esta área e quem mantem a aplicação, e para essa pessoa a informação útil
 * e exatamente qual rota falta — ela e quem vai escreve-lá.
 *
 * O aviso some sozinho no dia em que a rota responder: a tela já esta
 * inteira do lado de ca, e este componente só aparece no `404`.
 */

export interface MissingRouteProps {
  /** `GET /audit` — o método e o caminho, como se escreveria no controller. */
  route: string;
  /** O que essa rota precisa devolver, em uma ou duas frases. */
  children: ReactNode;
  /** O que fazer enquanto isso, quando há um caminho alternativo. */
  workaround?: ReactNode;
}

export function MissingRoute({ route, children, workaround }: MissingRouteProps) {
  return (
    <div className={styles.box}>
      <AlertIcon className={styles.icon} />

      <div className={styles.text}>
        <h3 className={styles.title}>Esta rota ainda não existe na API</h3>

        <p className={styles.route}>{route}</p>

        <p className={styles.body}>{children}</p>

        {workaround === undefined ? null : <p className={styles.workaround}>{workaround}</p>}
      </div>
    </div>
  );
}
