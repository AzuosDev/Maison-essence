import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { cx } from '@/lib/cx';
import styles from './brand-logo.module.css';

/**
 * A marca: monograma ME em moldura dourada sobre o nome em caixa alta.
 *
 * O `aria-label` carrega o nome inteiro e o monograma fica `aria-hidden`:
 * sem isso, um leitor de tela anuncia "M E Maison Essence" — o monograma e
 * as mesmas duas letras do nome, desenhadas.
 *
 * Nasce empilhada, que e a forma de repouso da marca. Deitar a assinatura,
 * encolher o monograma ou fechar o espacamento das letras e trabalho de quem
 * a coloca: as medidas são variáveis locais no CSS, e o cabeçalho as rege
 * pela classe que passa aqui. Uma variante "compacta" embutida aqui seria
 * uma segunda implementação do que o cabeçalho já faz — e foi exatamente ela
 * que, sem ninguém a usar, escondeu por um tempo a regra de celular.
 */
interface BrandLogoProps {
  /** Sobre fundo escuro. */
  inverted?: boolean;
  /** Sem link: no rodapé e na gaveta, onde a marca não e um caminho. */
  asLink?: boolean;
  className?: string | undefined;
}

export function BrandLogo({ inverted = false, asLink = true, className }: BrandLogoProps) {
  const content = (
    <>
      {/*
        As duas partes se anunciam por `data-part`.

        E o que deixa quem coloca a assinatura reger cada peca sem conhecer o
        nome da classe que o CSS Module gerou — o cabecalho esconde o nome ao
        encolher a barra no celular, e precisa de um jeito de apontar para
        ele. Atributo, e nao uma classe exportada: classe se copia para outro
        lugar por engano, `data-part` diz o que a peca e.
      */}
      <span className={styles.monogram} data-part="monogram" aria-hidden="true">
        ME
      </span>
      <span className={styles.wordmark} data-part="wordmark">
        Maison Essence
      </span>
    </>
  );

  const classes = cx(styles.logo, inverted && styles.inverted, className);

  if (!asLink) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <Link to={ROUTES.home} className={classes} aria-label="Maison Essence, página inicial">
      {content}
    </Link>
  );
}
