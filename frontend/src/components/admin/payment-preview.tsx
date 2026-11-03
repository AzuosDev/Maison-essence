import { Input } from '@/components/ui';
import type { CardPreviewRules, PixPreview, PlanContrast } from '@/features/admin';
import {
  CARD_PLAN_LABELS,
  buildInstallmentOptions,
  netOf,
  type InstallmentOption,
} from '@/features/payments';
import { formatCents } from '@/lib/format';
import styles from './payment-preview.module.css';

/**
 * O que a cliente vê, com as regras que ainda não foram salvas.
 *
 * ## Por que esta tela precisa de uma prévia
 *
 * "16,66% em 12x" e "parcela mínima de R$ 20" não dizem nada sozinhos. O que
 * eles significam e uma lista: quantas opções a cliente vai ver, qual e a
 * última que aparece, e quanto ela paga a mais na maior delas. A dona decide
 * olhando para essa lista, e não para a tabela que a produz.
 *
 * Três regras só se descobrem assim, e as três apagam opções em silêncio: a
 * parcela mínima corta o fim da lista, o limite absorvido decide onde o total
 * começa a subir, e a taxa que ninguém cadastrou faz a parcela desaparecer.
 *
 * ## As duas modalidades, uma embaixo da outra
 *
 * O limite sem juros e um só, então a primeira lista — a que a loja absorve —
 * vale para as duas e aparece uma vez. O que muda e o resto, e e por isso que
 * o link e a maquininha ganham um bloco cada: a mesma compra em 6x custa um
 * valor em cada tabela, e essa diferença e a decisão que a tela existe para
 * mostrar.
 *
 * ## O preço de absorver
 *
 * "Sem juros até 3x" e uma frase simpática na vitrine e uma linha no extrato.
 * A prévia escreve, em reais, quanto a loja recebe nessas parcelas — e e o
 * único lugar do painel onde esse número aparece.
 *
 * ## E quanto custa o outro plano
 *
 * Pela mesma razão. Duas tabelas de percentuais não respondem se vale a pena
 * receber na hora; uma venda de R$ 300 com os dois planos lado a lado
 * responde. A última linha do bloco faz essa conta.
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
  card: CardPreviewRules | null;
  /** O que o outro plano da operadora mudaria nesta venda, quando há o que comparar. */
  contrast: PlanContrast | null;
}

export function PaymentPreview({
  amount,
  amountCents,
  onAmountChange,
  pix,
  card,
  contrast,
}: PaymentPreviewProps) {
  // A lista sem juros e a mesma nas duas modalidades — dentro do limite a
  // tabela nem e consultada —, então ela sai de uma só e aparece uma vez.
  const byLink =
    card === null || amountCents === null ? [] : buildInstallmentOptions(amountCents, card.link);
  const byTap =
    card === null || amountCents === null ? [] : buildInstallmentOptions(amountCents, card.tap);
  const absorbed = byLink.filter((option) => !option.hasInterest);

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
            <p className={styles.groupTitle}>Sem juros, nas duas formas</p>

            <ol className={styles.options}>
              {absorbed.map((option) => (
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

            <Absorbed
              rules={card}
              totalCents={amountCents}
              count={absorbed.at(-1)?.count ?? 0}
            />

            <Financed title="Com juros, pelo link" options={byLink} />

            <Financed title="Com juros, na maquininha" options={byTap} />

            <Cut
              link={byLink.length}
              tap={byTap.length}
              maxInstallments={card.link.maxInstallments}
              minInstallmentCents={card.link.minInstallmentCents}
            />

            <Plan contrast={contrast} />
          </>
        )}
      </section>
    </aside>
  );
}

/**
 * Quanto a loja recebe nas parcelas que ela absorve.
 *
 * Só a última, e não uma linha por parcela: a taxa cresce com o número de
 * vezes, então o maior parcelamento sem juros e o que mais custa — e o
 * número que decide se o limite esta no lugar certo.
 */
function Absorbed({
  rules,
  totalCents,
  count,
}: {
  rules: CardPreviewRules;
  totalCents: number;
  count: number;
}) {
  const link = rules.link.feePercents.get(count);
  const tap = rules.tap.feePercents.get(count);

  if (count < 2 || link === undefined || tap === undefined) {
    return null;
  }

  return (
    <p className={styles.cost}>
      Em {String(count)}x a taxa e sua: você recebe {formatCents(netOf(totalCents, link))} pelo
      link e {formatCents(netOf(totalCents, tap))} na maquininha.
    </p>
  );
}

/**
 * As parcelas com a taxa repassada, de uma modalidade.
 *
 * O total vai junto do valor da parcela porque e ele que se compara com o
 * preço a vista — "12x de R$ 29,99" sem o total esconde exatamente o que a
 * cliente vai somar sozinha.
 */
function Financed({
  title,
  options,
}: {
  title: string;
  options: readonly InstallmentOption[];
}) {
  const financed = options.filter((option) => option.hasInterest);

  if (financed.length === 0) {
    return null;
  }

  return (
    <>
      <p className={styles.groupTitle}>{title}</p>

      <ol className={styles.options}>
        {financed.map((option) => (
          <li key={option.count} className={styles.option}>
            <span className={styles.count}>{String(option.count)}x</span>

            <span className={styles.amount}>de {formatCents(option.installmentCents)}</span>

            <span className={styles.total}>{formatCents(option.totalCents)}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * Quantas opções sumiram da lista, e por que.
 *
 * Fica no fim do bloco inteiro, e não dentro de cada modalidade, porque a
 * lista encurta também quando nenhuma parcela chega a ter juros: num pedido
 * de R$ 90 a lista acaba em 4x por causa da parcela mínima, sem nenhum grupo
 * "com juros" na tela para pendurar o aviso. E ali, justamente, que a dona
 * mais precisa dele.
 *
 * As duas modalidades podem parar em lugares diferentes — a taxa maior
 * levanta o total e a parcela demora mais a cair abaixo do mínimo —, e
 * quando param, a frase diz as duas.
 */
function Cut({
  link,
  tap,
  maxInstallments,
  minInstallmentCents,
}: {
  link: number;
  tap: number;
  maxInstallments: number;
  minInstallmentCents: number;
}) {
  const porque = `a parcela cai abaixo de ${formatCents(minInstallmentCents)}, ou a taxa não esta cadastrada`;

  if (link === maxInstallments && tap === maxInstallments) {
    return null;
  }

  if (link === tap) {
    return (
      <p className={styles.note}>
        Faltam {String(maxInstallments - link)} opções na lista: {porque}.
      </p>
    );
  }

  return (
    <p className={styles.note}>
      Faltam {String(maxInstallments - link)} opções pelo link e{' '}
      {String(maxInstallments - tap)} na maquininha: {porque}.
    </p>
  );
}

/**
 * O que o outro plano da operadora mudaria nesta venda.
 *
 * Em reais, porque a pergunta e em reais: a dona não esta escolhendo entre
 * 9,67% e 13,50%, esta escolhendo entre receber em trinta dias e receber na
 * hora pagando por isso. O percentual não responde; o valor de uma venda de
 * verdade responde.
 *
 * O sujeito da frase muda com a parcela, e e a parte que mais importa.
 * Dentro do limite sem juros a taxa sai da loja, então o plano mexe no que
 * **ela recebe**. Acima dele a taxa e repassada, e o plano mexe no que **a
 * cliente paga** — que não e custo da loja, e e um jeito diferente de perder
 * dinheiro.
 */
function Plan({ contrast }: { contrast: PlanContrast | null }) {
  if (contrast === null) {
    return null;
  }

  const plan = CARD_PLAN_LABELS[contrast.other];
  const money = formatCents(Math.abs(contrast.differenceCents));
  const count = contrast.count === 1 ? 'a vista' : `${String(contrast.count)}x`;

  return (
    <p className={styles.cost}>
      {contrast.absorbed
        ? `No plano ${plan}, esta venda ${count} pelo link renderia ${money} ${contrast.differenceCents > 0 ? 'a menos' : 'a mais'} para a loja.`
        : `No plano ${plan}, a cliente pagaria ${money} ${contrast.differenceCents > 0 ? 'a mais' : 'a menos'} em ${count} pelo link.`}
    </p>
  );
}
