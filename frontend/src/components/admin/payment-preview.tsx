import { Input } from '@/components/ui';
import type { PixPreview } from '@/features/admin';
import { buildInstallmentOptions, type PublicCard } from '@/features/payments';
import { formatCents } from '@/lib/format';
import styles from './payment-preview.module.css';

/**
 * O que a cliente vê, com as regras que ainda não foram salvas.
 *
 * ## Por que esta tela precisa de uma prévia
 *
 * "1,99% ao mês" e "parcela mínima de R$ 20" não dizem nada sozinhos. O que
 * eles significam e uma lista: quantas opções a cliente vai ver, qual e a
 * última que aparece, e quanto ela paga a mais na maior delas. A dona decide
 * olhando para essa lista, e não para os quatro números que a produzem.
 *
 * Duas regras só se descobrem assim, e as duas apagam opções em silêncio:
 * a parcela mínima corta o fim da lista, e o limite sem juros decide onde o
 * total começa a subir.
 *
 * ## A prévia lê o rascunho
 *
 * Os números aqui são os que estão nos campos, e não os que estão gravados.
 * E o único jeito de a decisão acontecer antes de valer — depois de salvar,
 * a regra já esta no ar para quem estiver comprando. Por isso a barra de
 * salvar diz, com todas as letras, que o que se vê aqui ainda não vale.
 *
 * ## O valor de exemplo e editável
 *
 * Começa em R$ 300, que e a faixa da maioria dos pedidos da loja. Mas a
 * pergunta que aparece depois e sempre "e num pedido de R$ 80?" — e e nela
 * que a parcela mínima aparece cortando a lista pela metade.
 */
export interface PaymentPreviewProps {
  /** O valor de exemplo, como texto: e um campo. */
  amount: string;
  /** O mesmo valor em centavos, ou `null` enquanto ainda não e um número. */
  amountCents: number | null;
  onAmountChange: (value: string) => void;
  /** `null` com o PIX desligado. */
  pix: PixPreview | null;
  /** `null` com o cartão desligado, ou enquanto um campo esta pela metade. */
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

  // Quantas opções a parcela mínima tirou do fim da lista. E a regra que
  // menos se enxerga olhando para o campo que a define.
  const cut = card === null ? 0 : card.maxInstallments - options.length;

  return (
    <aside className={styles.panel} aria-label="Prévia do pagamento">
      <div className={styles.head}>
        <h2 className={styles.title}>O que a cliente vê</h2>

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
          <p className={styles.off}>Desligado: a cliente não vê a opção de PIX.</p>
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
              {formatCents(pix.discountCents)} de desconto. Não vale sobre a entrega.
            </p>
          </>
        )}
      </section>

      <section className={styles.block} aria-labelledby="preview-card">
        <h3 className={styles.blockTitle} id="preview-card">
          Cartão
        </h3>

        {card === null ? (
          <p className={styles.off}>Desligado: o checkout não oferece parcelamento.</p>
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
                    {card.monthlyInterestPercent.toLocaleString('pt-BR')}% ao mês
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
                {formatCents(card.minInstallmentCents)}, e a opção não aparece.
              </p>
            ) : null}
          </>
        )}
      </section>
    </aside>
  );
}
