import { useStoreSettings } from '@/features/settings';
import styles from './announcement-bar.module.css';

/**
 * A barra preta do topo, com o aviso da loja rolando.
 *
 * O texto vem de `announcementText` das configurações — a dona edita no
 * painel e a barra muda sem deploy. Quando não há texto, a barra não existe:
 * uma faixa preta vazia no topo da loja e pior que faixa nenhuma.
 *
 * O aviso e escrito duas vezes no markup, e a segunda copia e
 * `aria-hidden`. Ela existe só para o desenho: e o que faz o texto reentrar
 * pela direita no instante em que o primeiro sai pela esquerda, sem o vazio
 * que uma faixa de copia única deixaria. Para quem ouve a página, o aviso
 * continua sendo um só.
 */
export function AnnouncementBar() {
  const { settings } = useStoreSettings();
  const text = settings?.announcementText.trim();

  if (!text) {
    return null;
  }

  return (
    <div className={styles.bar}>
      <div className={styles.viewport}>
        <div className={styles.track}>
          <p className={styles.copy}>
            {text}
            <span className={styles.separator} aria-hidden="true">
              ◆
            </span>
          </p>

          <p className={styles.copy} aria-hidden="true">
            {text}
            <span className={styles.separator}>◆</span>
          </p>
        </div>
      </div>
    </div>
  );
}
