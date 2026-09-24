import type { ReactNode } from 'react';
import { AlertIcon } from './admin-icons';
import styles from './missing-route.module.css';

/**
 * A tela funciona; a rota que ela chama ainda nao existe.
 *
 * ## Por que isto e um componente, e nao um erro generico
 *
 * Tres telas da area de sistema chamam rotas que o backend nao publica: a
 * trilha de auditoria (`GET /audit`), a contagem por colecao e o seed de
 * demonstracao. O modulo de auditoria, por exemplo, tem servico, colecao e
 * dois anos de retencao — so nao tem controlador.
 *
 * "Algo deu errado. Tente novamente em instantes." seria mentira nos tres
 * casos: nao ha nada de errado e tentar de novo nao muda nada. Quem abre
 * esta area e quem mantem a aplicacao, e para essa pessoa a informacao util
 * e exatamente qual rota falta — ela e quem vai escreve-la.
 *
 * O aviso some sozinho no dia em que a rota responder: a tela ja esta
 * inteira do lado de ca, e este componente so aparece no `404`.
 */

export interface MissingRouteProps {
  /** `GET /audit` — o metodo e o caminho, como se escreveria no controller. */
  route: string;
  /** O que essa rota precisa devolver, em uma ou duas frases. */
  children: ReactNode;
  /** O que fazer enquanto isso, quando ha um caminho alternativo. */
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
