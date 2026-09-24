import { ROUTES } from '@/app/routes';
import { BrandLogo } from '@/components/store';
import { ButtonLink, Container } from '@/components/ui';
import { INSTITUTIONAL_PAGE_SLUGS } from '@/features/settings';
import { cx } from '@/lib/cx';
import styles from './brand-statement.module.css';

/**
 * O banner institucional, no meio da home.
 *
 * O texto e fixo, e não vem do painel. E a mesma regra dos selos de
 * confiança: isto e uma afirmação sobre como a loja trabalha — seleção curta,
 * original, entrega combinada no WhatsApp — e não um campo que se ajusta de
 * um dia para o outro. Quando deixar de ser verdade, muda aqui, com revisão.
 *
 * O link leva a página "Quem somos", que aí sim a dona escreve pelo painel:
 * este bloco e a chamada, e a página e o texto inteiro.
 */
export function BrandStatement() {
  return (
    <section className={cx(styles.statement, 'on-dark')} aria-label="Sobre a Maison Essence">
      <Container className={styles.inner}>
        <BrandLogo asLink={false} inverted className={styles.signature} />

        <span className={styles.rule} aria-hidden="true" />

        <p className={styles.text}>
          Uma seleção curta, escolhida peça a peça. Perfumes e velas que a gente compraria para casa
          — e por isso responde por cada um deles.
        </p>

        <p className={styles.note}>
          Produtos originais, conferidos antes de sair. Retirada combinada em Juazeiro do Norte e
          envio para todo o Brasil.
        </p>

        <ButtonLink
          to={ROUTES.page(INSTITUTIONAL_PAGE_SLUGS.ABOUT)}
          variant="secondary"
          className={styles.action}
        >
          Conheca a loja
        </ButtonLink>
      </Container>
    </section>
  );
}
