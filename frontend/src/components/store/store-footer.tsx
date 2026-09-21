import { Container } from '@/components/ui';
import styles from './store-chrome.module.css';

/**
 * O rodape da loja.
 *
 * O ano sai do relogio do navegador: rodape com ano fixo envelhece em
 * silencio e e sempre a ultima coisa que alguem percebe.
 *
 * Os links institucionais, as redes e o contato vem de `GET /settings` e
 * entram aqui junto com as telas.
 */
export function StoreFooter() {
  return (
    <footer className={styles.footer}>
      <Container className={styles.footerInner}>
        <p className={styles.footerBrand}>Maison Essence</p>
        <p className={styles.footerNote}>
          © {new Date().getFullYear()} Maison Essence. Perfumes e velas aromaticas.
        </p>
      </Container>
    </footer>
  );
}
