import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import styles from './step-card.module.css';

/**
 * A moldura de um passo do checkout.
 *
 * Os quatro passos tem a mesma anatomia — cartao branco, titulo, campos
 * empilhados, botao largo embaixo — e ela mora aqui, em um lugar so. Escrita
 * em cada passo, essa anatomia divergiria no primeiro ajuste: um cartao com
 * padding diferente, um botao "Voltar" que aparece em tres passos e some no
 * quarto, um titulo que muda de tamanho no meio do fluxo. A consistencia
 * entre telas vizinhas e o que faz o checkout parecer uma coisa so.
 *
 * ## O foco que acompanha o passo
 *
 * Trocar de passo troca o conteudo inteiro da tela sem mudar de endereco.
 * Para quem enxerga, a mudanca e obvia; para quem navega por teclado ou usa
 * leitor de tela, o foco continuaria no botao que acabou de sumir — e a
 * leitura recomecaria do topo da pagina, ou de lugar nenhum.
 *
 * Por isso o titulo recebe o foco quando o passo muda. `tabIndex={-1}` o
 * torna focavel por codigo sem entrar na ordem do Tab, e o navegador rola
 * ate ele de quebra, que e o que resolve o passo longo no celular.
 *
 * `focusOnMount` e `false` na primeira renderizacao da pagina de proposito:
 * quem acabou de chegar ao checkout deve comecar do topo, com o cabecalho e
 * a trilha, e nao com o foco jogado no meio do documento.
 */

export interface StepCardProps {
  title: string;
  /** Uma linha de contexto embaixo do titulo. */
  description?: ReactNode;
  /** O passo mudou por acao do cliente: leve o foco para o titulo. */
  focusOnMount: boolean;
  /** O rotulo do botao que avanca. */
  actionLabel: string;
  onAction: () => void;
  /** O botao que avanca esta impedido — item indisponivel, envio em curso. */
  actionDisabled?: boolean;
  /** Circulo girando no botao, e o botao desabilitado junto. */
  actionLoading?: boolean;
  /** Ausente no primeiro passo, que nao tem para onde voltar. */
  onBack?: (() => void) | undefined;
  backLabel?: string;
  /**
   * O total, para a linha que aparece **so no celular**, logo acima do
   * botao.
   *
   * No desktop o resumo esta ao lado, sempre visivel. No celular ele fica
   * abaixo do cartao, e quem chega ao botao chegaria nele sem ter visto o
   * numero — esta linha poe o valor no ponto da decisao, sem repetir o
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
   * Roda uma vez por passo, e nao a cada render: a pagina remonta este
   * componente a cada troca de etapa (`key` na etapa), entao "montou" e
   * exatamente "o passo mudou". `focusOnMount` esta nas dependencias porque
   * e o que o efeito le — e, por nao mudar durante a vida do componente, o
   * efeito continua rodando uma vez so.
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
         * manter as duas ordens iguais e o que faz o Tab percorrer os botoes
         * na mesma sequencia em que eles sao lidos. Inverter uma delas no
         * CSS resolveria o desenho e quebraria o teclado.
         *
         * No celular isso ainda poe a acao principal na ultima linha do
         * cartao, que e onde o polegar ja esta.
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
