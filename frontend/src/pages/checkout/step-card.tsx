import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import styles from './step-card.module.css';

/**
 * A moldura de um passo do checkout.
 *
 * Os quatro passos tem a mesma anatomia — cartão branco, título, campos
 * empilhados, botão largo embaixo — e ela mora aqui, em um lugar só. Escrita
 * em cada passo, essa anatomia divergiria no primeiro ajuste: um cartão com
 * padding diferente, um botão "Voltar" que aparece em três passos e some no
 * quarto, um título que muda de tamanho no meio do fluxo. A consistência
 * entre telas vizinhas e o que faz o checkout parecer uma coisa só.
 *
 * ## O foco que acompanha o passo
 *
 * Trocar de passo troca o conteúdo inteiro da tela sem mudar de endereço.
 * Para quem enxerga, a mudanca e obvia; para quem navega por teclado ou usa
 * leitor de tela, o foco continuaria no botão que acabou de sumir — e a
 * leitura recomecaria do topo da página, ou de lugar nenhum.
 *
 * Por isso o título recebe o foco quando o passo muda. `tabIndex={-1}` o
 * torna focável por código sem entrar na ordem do Tab, e o navegador rola
 * até ele de quebra, que e o que resolve o passo longo no celular.
 *
 * `focusOnMount` e `false` na primeira renderização da página de propósito:
 * quem acabou de chegar ao checkout deve começar do topo, com o cabeçalho e
 * a trilha, e não com o foco jogado no meio do documento.
 */

export interface StepCardProps {
  title: string;
  /** Uma linha de contexto embaixo do título. */
  description?: ReactNode;
  /** O passo mudou por ação do cliente: leve o foco para o título. */
  focusOnMount: boolean;
  /** O rótulo do botão que avança. */
  actionLabel: string;
  onAction: () => void;
  /** O botão que avança esta impedido — item indisponível, envio em curso. */
  actionDisabled?: boolean;
  /** Círculo girando no botão, e o botão desabilitado junto. */
  actionLoading?: boolean;
  /** Ausente no primeiro passo, que não tem para onde voltar. */
  onBack?: (() => void) | undefined;
  backLabel?: string;
  /**
   * O total, para a linha que aparece **só no celular**, logo acima do
   * botão.
   *
   * No desktop o resumo esta ao lado, sempre visível. No celular ele fica
   * abaixo do cartão, e quem chega ao botão chegaria nele sem ter visto o
   * número — esta linha põe o valor no ponto da decisão, sem repetir o
   * resumo inteiro.
   */
  total?: ReactNode;
  children: ReactNode;
}

export function StepCard({
  title,
  description,
  focusOnMount,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionLoading = false,
  onBack,
  backLabel = 'Voltar',
  total,
  children,
}: StepCardProps) {
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  /**
   * Roda uma vez por passo, e não a cada render: a página remonta este
   * componente a cada troca de etapa (`key` na etapa), então "montou" e
   * exatamente "o passo mudou". `focusOnMount` esta nas dependências porque
   * e o que o efeito lê — e, por não mudar durante a vida do componente, o
   * efeito continua rodando uma vez só.
   */
  useEffect(() => {
    if (focusOnMount) {
      heading.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId} ref={heading} tabIndex={-1} className={styles.title}>
          {title}
        </h2>

        {description ? <p className={styles.description}>{description}</p> : null}
      </div>

      <div className={styles.body}>{children}</div>

      <div className={styles.footer}>
        {total ? <div className={styles.total}>{total}</div> : null}

        {/*
         * Voltar antes de continuar, na ordem do documento.
         *
         * E a ordem em que os dois aparecem na tela nos dois tamanhos — em
         * cima e embaixo no celular, a esquerda e a direita no desktop —, e
         * manter as duas ordens iguais e o que faz o Tab percorrer os botões
         * na mesma sequência em que eles são lidos. Inverter uma delas no
         * CSS resolveria o desenho e quebraria o teclado.
         *
         * No celular isso ainda poe a ação principal na última linha do
         * cartão, que e onde o polegar já esta.
         */}
        <div className={styles.actions}>
          {onBack ? (
            <Button variant="ghost" onClick={onBack} disabled={actionLoading}>
              {backLabel}
            </Button>
          ) : null}

          <Button
            onClick={onAction}
            disabled={actionDisabled}
            loading={actionLoading}
            loadingLabel="Enviando o pedido"
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </section>
  );
}
