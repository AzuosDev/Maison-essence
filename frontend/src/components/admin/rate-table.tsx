import { Fragment, useState } from 'react';
import { Button, Input, Tab, TabList, TabPanel, Tabs } from '@/components/ui';
import { hasAnyRate, syncedRates, type RateDraft } from '@/features/admin';
import {
  CARD_PLANS,
  CARD_PLAN_LABELS,
  CARD_PLAN_NOTES,
  CARD_PLAN_VALUES,
  type CardPlan,
} from '@/features/payments';
import styles from './rate-table.module.css';

/**
 * A tabela de taxas da operadora, do jeito que ela aparece no aplicativo.
 *
 * ## Por que isto e uma tabela digitada e não um campo de juros
 *
 * A maquininha não cobra juros ao mês: cobra **uma taxa única sobre a venda**,
 * diferente para cada quantidade de parcelas, e desconta tudo na hora. As
 * taxas não crescem de forma suave — de 6x para 7x a desta loja pula de 9,67%
 * para 12,59% —, e formula nenhuma reproduz esse degrau. A única fonte
 * correta e a tela da operadora, e o trabalho desta tabela e ser fácil de
 * copiar dela: uma linha por parcela, duas colunas, na mesma ordem.
 *
 * ## Duas colunas, lado a lado
 *
 * O link de pagamento e a maquininha têm tabelas diferentes, e a diferença
 * entre elas e o que a cliente vê no checkout. Lado a lado, a comparação e um
 * movimento de olho; em duas telas separadas, e memoria.
 *
 * ## Dois planos, um atrás do outro
 *
 * A operadora publica a mesma tabela duas vezes: uma no plano padrão e outra
 * no Nitro, que adianta o dinheiro da venda parcelada e cobra mais por isso.
 * Só uma vale por vez, e e essa a razão de serem abas e não colunas: as
 * modalidades se comparam o tempo todo, os planos se comparam uma vez e
 * depois um deles e esquecido por meses.
 *
 * A aba abre no plano em uso, e o selo diz qual e ele — porque a pergunta que
 * se faz ao chegar nesta tela não e "quais planos existem", e sim "por qual
 * tabela a loja esta cobrando agora".
 *
 * ## O que uma linha vazia significa
 *
 * Que a parcela não e oferecida — e não que ela e de graça. A alternativa
 * seria a loja vender em 11x e pagar os 15,87% sozinha, sem nada na tela
 * dizendo isso. A prévia ao lado mostra a lista encurtada, que e onde a falta
 * aparece.
 */
export interface RateTableProps {
  rates: readonly RateDraft[];
  /** A tabela do Nitro. Toda em branco enquanto a loja não usa o plano. */
  nitroRates: readonly RateDraft[];
  /** Qual das duas cota o checkout hoje. */
  activePlan: CardPlan;
  /** Como esta no rascunho: texto, porque e o valor de um campo. */
  maxInstallments: string;
  interestFreeUpTo: string;
  /** Por quantidade de parcelas, quando há. */
  errors: Record<number, string> | undefined;
  nitroErrors: Record<number, string> | undefined;
  onChange: (plan: CardPlan, rates: RateDraft[]) => void;
  onActivate: (plan: CardPlan) => void;
}

export function RateTable({
  rates,
  nitroRates,
  activePlan,
  maxInstallments,
  interestFreeUpTo,
  errors,
  nitroErrors,
  onChange,
  onActivate,
}: RateTableProps) {
  // A aba aberta e estado da tela, e não do rascunho: trocar de aba não e
  // uma alteração para salvar, e a barra de "alterações não salvas" não pode
  // aparecer porque alguém foi olhar a outra tabela.
  const [shown, setShown] = useState<CardPlan>(activePlan);

  const max = countOf(maxInstallments);
  const free = countOf(interestFreeUpTo);

  const draftOf = (plan: CardPlan): readonly RateDraft[] =>
    plan === CARD_PLANS.NITRO ? nitroRates : rates;
  const errorsOf = (plan: CardPlan): Record<number, string> | undefined =>
    plan === CARD_PLANS.NITRO ? nitroErrors : errors;

  return (
    <section className={styles.block} aria-labelledby="taxas-operadora">
      <h3 className={styles.title} id="taxas-operadora">
        Taxas da operadora
      </h3>

      <p className={styles.hint}>
        Copie da calculadora do aplicativo da maquininha. E uma taxa única sobre a venda, por
        quantidade de parcelas — não e juros ao mês. Quando a operadora reajustar, e aqui que
        se corrige.
      </p>

      <Tabs
        value={shown}
        onChange={(value) => {
          setShown(value as CardPlan);
        }}
      >
        <TabList aria-label="Plano da operadora">
          {CARD_PLAN_VALUES.map((plan) => {
            const broken = Object.keys(errorsOf(plan) ?? {}).length > 0;

            return (
              <Tab key={plan} value={plan} className={styles.tab}>
                {CARD_PLAN_LABELS[plan]}

                {plan === activePlan ? <span className={styles.inUse}>em uso</span> : null}

                {/*
                  A tabela escondida também e conferida, e o erro dela recusa
                  a gravação inteira. Sem esta marca, "Salvar" não faria nada
                  e a tela não teria dito por que.
                */}
                {broken ? (
                  <>
                    <span className={styles.flag} aria-hidden="true" />
                    <span className="visually-hidden">tem erro para corrigir</span>
                  </>
                ) : null}
              </Tab>
            );
          })}
        </TabList>

        {CARD_PLAN_VALUES.map((plan) => (
          <TabPanel key={plan} value={plan} className={styles.panel}>
            <PlanState
              plan={plan}
              activePlan={activePlan}
              rates={draftOf(plan)}
              onActivate={onActivate}
            />

            <Grid
              rows={max === null ? [...draftOf(plan)] : syncedRates(draftOf(plan), max)}
              errors={errorsOf(plan)}
              max={max}
              free={free}
              onChange={(rows) => {
                onChange(plan, rows);
              }}
            />
          </TabPanel>
        ))}
      </Tabs>
    </section>
  );
}

/**
 * Qual e o papel deste plano agora, e como trocar.
 *
 * A troca mora aqui, dentro da aba, e não num seletor acima das duas: ligar o
 * Nitro e uma decisão que se toma **olhando para a tabela dele** — se ela
 * esta preenchida, se os números são os de hoje. Um seletor no topo deixaria
 * ligar um plano sem nunca ter visto a tabela que ele cobra.
 *
 * O botão não grava: alimenta o rascunho, e a troca sobe junto da tabela no
 * mesmo `PATCH`. Preencher o Nitro e liga-lo são uma gravação só, e não duas
 * — com duas, a primeira metade salva e a segunda esquecida deixaria a loja
 * cobrando pela tabela errada.
 */
function PlanState({
  plan,
  activePlan,
  rates,
  onActivate,
}: {
  plan: CardPlan;
  activePlan: CardPlan;
  rates: readonly RateDraft[];
  onActivate: (plan: CardPlan) => void;
}) {
  if (plan === activePlan) {
    return (
      <p className={styles.state}>
        <strong className={styles.stateTitle}>Em uso.</strong> {CARD_PLAN_NOTES[plan]}
      </p>
    );
  }

  const ready = hasAnyRate(rates);

  return (
    <div className={styles.swap}>
      <p className={styles.state}>
        <strong className={styles.stateTitle}>Fora de uso.</strong> {CARD_PLAN_NOTES[plan]}{' '}
        {ready
          ? `O checkout cobra pela tabela do plano ${CARD_PLAN_LABELS[activePlan]}.`
          : 'Preencha a tabela abaixo para poder usar este plano.'}
      </p>

      <Button
        type="button"
        variant="secondary"
        size="small"
        disabled={!ready}
        onClick={() => {
          onActivate(plan);
        }}
      >
        Usar o {CARD_PLAN_LABELS[plan]}
      </Button>
    </div>
  );
}

/** As linhas de uma tabela: uma por parcela, duas células cada. */
function Grid({
  rows,
  errors,
  max,
  free,
  onChange,
}: {
  rows: RateDraft[];
  errors: Record<number, string> | undefined;
  max: number | null;
  free: number | null;
  onChange: (rows: RateDraft[]) => void;
}) {
  const change = (installments: number, column: 'link' | 'tap', value: string): void => {
    onChange(
      rows.map((row) =>
        row.installments === installments ? { ...row, [column]: value } : row,
      ),
    );
  };

  return (
    <div className={styles.table}>
      <span className={styles.head} aria-hidden="true">
        Parcelas
      </span>
      <span className={styles.head} aria-hidden="true">
        Link
      </span>
      <span className={styles.head} aria-hidden="true">
        Maquininha
      </span>

      {rows.map((row) => {
        const error = errors?.[row.installments];
        const errorId = error === undefined ? undefined : `taxa-erro-${String(row.installments)}`;
        const label = row.installments === 1 ? 'a vista' : `${String(row.installments)}x`;

        return (
          <Fragment key={row.installments}>
            {free !== null && row.installments === free + 1 ? (
              <p className={styles.note}>
                Daqui para baixo a taxa e somada ao valor que a cliente paga. Acima, ela sai da
                loja.
              </p>
            ) : null}

            {max !== null && row.installments === max + 1 ? (
              <p className={styles.note}>
                A loja parcela em até {String(max)}x. As taxas abaixo ficam guardadas e não são
                usadas.
              </p>
            ) : null}

            <span className={styles.count}>{label}</span>

            <Input
              label={`Taxa do link em ${label}`}
              hideLabel
              block
              numeric
              inputMode="decimal"
              suffix="%"
              placeholder="0,00"
              value={row.link}
              aria-invalid={error === undefined ? undefined : true}
              aria-describedby={errorId}
              onChange={(event) => {
                change(row.installments, 'link', event.target.value);
              }}
            />

            <Input
              label={`Taxa da maquininha em ${label}`}
              hideLabel
              block
              numeric
              inputMode="decimal"
              suffix="%"
              placeholder="0,00"
              value={row.tap}
              aria-invalid={error === undefined ? undefined : true}
              aria-describedby={errorId}
              onChange={(event) => {
                change(row.installments, 'tap', event.target.value);
              }}
            />

            {error === undefined ? null : (
              <p className={styles.error} id={errorId}>
                {error}
              </p>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

/** O número do campo, ou `null` enquanto ele ainda não e um número. */
function countOf(value: string): number | null {
  const trimmed = value.trim();

  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}
