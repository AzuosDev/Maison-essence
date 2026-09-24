import { Suspense, lazy } from 'react';
import styles from './newsletter-form.module.css';

/**
 * A newsletter, fora do caminho crítico.
 *
 * O formulário carrega `react-hook-form`, `zod` e o resolvedor que liga os
 * dois — cerca de trinta kilobytes comprimidos que, importados direto, iam
 * parar no pedaço que o navegador precisa baixar e interpretar **antes** de
 * desenhar qualquer coisa. Eles pagam por um campo de e-mail que fica no
 * rodapé, muito abaixo da dobra, e que ninguém toca antes de rolar a página
 * inteira. Numa conexão 3G isso e meio segundo cobrado da foto do hero, que
 * e o LCP da home.
 *
 * Com o `lazy`, esses trinta kilobytes viram um pedido separado, que não
 * bloqueia o primeiro desenho. O que fica no lugar enquanto ele não chega e
 * um bloco da altura exata do formulário — ver `.placeholder` na folha de
 * estilo —, então a troca não mexe em nada do que já esta na tela.
 *
 * Quem precisa do formulário de imediato — uma página que fosse só a
 * inscrição — importa `NewsletterForm` direto.
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
