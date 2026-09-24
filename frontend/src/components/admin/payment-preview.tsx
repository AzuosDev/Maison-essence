import { Input } from '@/components/ui';
import type { PixPreview } from '@/features/admin';
import { buildInstallmentOptions, type PublicCard } from '@/features/payments';
import { formatCents } from '@/lib/format';
import styles from './payment-preview.module.css';

/**
 * O que a cliente ve, com as regras que ainda nao foram salvas.
 *
 * ## Por que esta tela precisa de uma previa
 *
 * "1,99% ao mes" e "parcela minima de R$ 20" nao dizem nada sozinhos. O que
 * eles significam e uma lista: quantas opcoes a cliente vai ver, qual e a
 * ultima que aparece, e quanto ela paga a mais na maior delas. A dona decide
 * olhando para essa lista, e nao para os quatro numeros que a produzem.
 *
 * Duas regras so se descobrem assim, e as duas apagam opcoes em silencio:
 * a parcela minima corta o fim da lista, e o limite sem juros decide onde o
 * total comeca a subir.
 *
 * ## A previa le o rascunho
 *
 * Os numeros aqui sao os que estao nos campos, e nao os que estao gravados.
 * E o unico jeito de a decisao acontecer antes de valer — depois de salvar,
 * a regra ja esta no ar para quem estiver comprando. Por isso a barra de
 * salvar diz, com todas as letras, que o que se ve aqui ainda nao vale.
 *
 * ## O valor de exemplo e editavel
 *
 * Comeca em R$ 300, que e a faixa da maioria dos pedidos da loja. Mas a
 * pergunta que aparece depois e sempre "e num pedido de R$ 80?" — e e nela
 * que a parcela minima aparece cortando a lista pela metade.
 */
export interface PaymentPreviewProps {
  /** O valor de exemplo, como texto: e um campo. */
  amount: string;
  /** O mesmo valor em centavos, ou `null` enquanto ainda nao e um numero. */
  amountCents: number | null;
  onAmountChange: (value: string) => void;
  /** `null` com o PIX desligado. */
  pix: PixPreview | null;
  /** `null` com o cartao desligado, ou enquanto um campo esta pela metade. */
  card: PublicCard | null;
}

export function PaymentPreview({
  amount,
  amountCents,
  onAmountChange,
  pix,
  card,
}: PaymentPreviewProps) {
  const options =
    card === null || amountCents === null ? [] : buildInstallmentOptions(amountCents, card);
  const interestFree = options.filter((option) => !option.hasInterest);
  const financed = options.filter((option) => option.hasInterest);

  // Quantas opcoes a parcela minima tirou do fim da lista. E a regra que
  // menos se enxerga olhando para o campo que a define.
  const cut = card === null ? 0 : card.maxInstallments - options.length;

  return (
    <aside className={styles.panel} aria-label="Previa do pagamento">
      <div className={styles.head}>
        <h2 className={styles.title}>O que a cliente ve</h2>

        <Input
          label="Num pedido de"
          block
          numeric
          inputMode="decimal"
          prefix="R$"
          placeholder="300,00"
          value={amount}
          onChange={(event) => {
            onAmountChange(event.target.value);
          }}
        />
      </div>

      <section className={styles.block} aria-labelledby="preview-pix">
        <h3 className={styles.blockTitle} id="preview-pix">
          PIX
        </h3>

        {pix === null ? (
          <p className={styles.off}>Desligado: a cliente nao ve a opcao de PIX.</p>
        ) : amountCents === null ? (
          <p className={styles.off}>Escreva um valor acima para ver o desconto.</p>
        ) : pix.discountCents === 0 ? (
          <p className={styles.line}>
            <span className={styles.lineLabel}>A vista no PIX</span>
            <span className={styles.amount}>{formatCents(pix.totalCents)}</span>
          </p>
        ) : (
          <>
            <p className={styles.line}>
              <span className={styles.lineLabel}>A vista no PIX</span>
              <span className={styles.amount}>{formatCents(pix.totalCents)}</span>
            </p>

            <p className={styles.saving}>
              {formatCents(pix.discountCents)} de desconto. Nao vale sobre a entrega.
            </p>
          </>
        )}
      </section>

      <section className={styles.block} aria-labelledby="preview-card">
        <h3 className={styles.blockTitle} id="preview-card">
          Cartao
        </h3>

        {card === null ? (
          <p className={styles.off}>Desligado: o checkout nao oferece parcelamento.</p>
        ) : amountCents === null ? (
          <p className={styles.off}>Escreva um valor acima para ver as parcelas.</p>
        ) : (
          <>
            <p className={styles.groupTitle}>Sem juros</p>

            <ol className={styles.options}>
              {interestFree.map((option) => (
                <li key={option.count} className={styles.option}>
                  <span className={styles.count}>
                    {option.count === 1 ? 'A vista' : `${String(option.count)}x`}
                  </span>

                  <span className={styles.amount}>
                    {option.count === 1
                      ? formatCents(option.totalCents)
                      : `de ${formatCents(option.installmentCents)}`}
                  </span>
                </li>
              ))}
            </ol>

            {financed.length === 0 ? null : (
              <>
                <p className={styles.groupTitle}>
                  Com juros, total mais alto
                  <span className={styles.groupRate}>
                    {card.monthlyInterestPercent.toLocaleString('pt-BR')}% ao mes
                  </span>
                </p>

                <ol className={styles.options}>
                  {financed.map((option) => (
                    <li key={option.count} className={styles.option}>
                      <span className={styles.count}>{String(option.count)}x</span>

                      <span className={styles.amount}>
                        de {formatCents(option.installmentCents)}
                      </span>

                      <span className={styles.total}>{formatCents(option.totalCents)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {cut > 0 ? (
              <p className={styles.note}>
                Acima de {String(options.length)}x a parcela fica abaixo de{' '}
                {formatCents(card.minInstallmentCents)}, e a opcao nao aparece.
              </p>
            ) : null}
          </>
        )}
      </section>
    </aside>
  );
}
