import { Suspense, lazy } from 'react';
import styles from './newsletter-form.module.css';

/**
 * A newsletter, fora do caminho critico.
 *
 * O formulario carrega `react-hook-form`, `zod` e o resolvedor que liga os
 * dois — cerca de trinta kilobytes comprimidos que, importados direto, iam
 * parar no pedaco que o navegador precisa baixar e interpretar **antes** de
 * desenhar qualquer coisa. Eles pagam por um campo de e-mail que fica no
 * rodape, muito abaixo da dobra, e que ninguem toca antes de rolar a pagina
 * inteira. Numa conexao 3G isso e meio segundo cobrado da foto do hero, que
 * e o LCP da home.
 *
 * Com o `lazy`, esses trinta kilobytes viram um pedido separado, que nao
 * bloqueia o primeiro desenho. O que fica no lugar enquanto ele nao chega e
 * um bloco da altura exata do formulario — ver `.placeholder` na folha de
 * estilo —, entao a troca nao mexe em nada do que ja esta na tela.
 *
 * Quem precisa do formulario de imediato — uma pagina que fosse so a
 * inscricao — importa `NewsletterForm` direto.
 */
const NewsletterForm = lazy(async () => ({
  default: (await import('./newsletter-form')).NewsletterForm,
}));

interface DeferredNewsletterProps {
  tone?: 'dark' | 'light';
}

export function DeferredNewsletter({ tone = 'dark' }: DeferredNewsletterProps) {
  return (
    <Suspense fallback={<div className={styles.placeholder} aria-hidden="true" />}>
      <NewsletterForm tone={tone} />
    </Suspense>
  );
}
