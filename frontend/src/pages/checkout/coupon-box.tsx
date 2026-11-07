import { useId, useState } from 'react';
import { CheckIcon } from '@/components/store';
import { Button, Input } from '@/components/ui';
import {
  COUPON_CODE_MAX,
  canSubmitCoupon,
  couponReachLabel,
  normalizeCouponCode,
  type CouponState,
} from '@/features/checkout';
import styles from './coupon-box.module.css';

/**
 * A caixa do cupom.
 *
 * Um componente só, nos dois lugares que mostram a conta: o resumo que
 * acompanha as etapas, a direita, e a revisão final — a mesma dobradinha de
 * `QuoteTotals`, e nunca os dois na mesma tela. O cupom pertence ao lado do
 * total nos dois casos: e ali que a cliente confere se o desconto que a loja
 * prometeu no story de fato entrou.
 *
 * Fica **acima** das linhas de dinheiro, e não embaixo. O cupom e o que mexe
 * nos números; um campo depois de "Total R$ 587,90" chega tarde para quem
 * acabou de ler o total e lê como lembrete de algo que já passou.
 *
 * ## Por que a caixa esta sempre aberta
 *
 * Quase toda loja esconde o cupom atrás de um "tem um cupom?" que expande. E
 * uma economia de sessenta pixels paga com a pior falha que esta feature
 * consegue produzir: a cliente digita o código na busca, na barra de
 * endereço, no campo de observação — ou fecha o pedido sem o desconto e manda
 * a mensagem perguntando por que. A campanha e da própria loja, anunciada na
 * home pela dona; esconder o lugar de resgatá-la e esconder a promessa.
 *
 * ## O campo sai quando o cupom entra
 *
 * Aplicado, não ha mais nada a digitar — só a tirar. Então o campo de texto
 * da lugar a confirmação: o código que valeu, e embaixo o nome da campanha
 * com o desconto. Um campo travado com `BLACKFRIDAY` dentro seria pior que
 * inútil — continuaria parecendo editável, e quem trocasse uma letra ficaria
 * com a tela dizendo um código e o pedido valendo outro.
 *
 * O chip confirma **o código**, e só ele. O desconto por extenso morava ali
 * dentro e desceu para a linha de baixo: nos cento e cinquenta pixels que
 * sobram na coluna do resumo, ele disputava a largura com um código de onze
 * letras e `BLACKFRIDAY` quebrava no meio — `BLACKFRID` numa linha, `AY` na
 * outra, num elemento cuja única razão de existir e mostrar o código exato
 * que valeu. O que o desconto rendeu em reais já esta duas linhas abaixo, na
 * conta, e e esse o número que a cliente veio conferir.
 *
 * O botão fica no mesmo lugar nos dois estados, e e de propósito: e o mesmo
 * elemento, na mesma posição da árvore, então o React o reaproveita e o foco
 * **não se perde** no clique que aplica. Quem navega por teclado aperta
 * "Aplicar", ouve a confirmação e continua de onde estava — sem nenhum efeito
 * caçando foco, que e a parte que costuma dar errado.
 *
 * ## A ligação escrita a mão
 *
 * O rótulo, a recusa e o `aria-describedby` são montados aqui em vez de
 * virem do `label` e do `error` do `Input`, e e a única razão disso: dentro
 * do campo, a frase de recusa cresce **dentro** da coluna e empurra o botão
 * "Aplicar" para baixo da linha do campo. Com a frase fora da fileira, os
 * dois controles tem a mesma altura e o mesmo topo em qualquer estado.
 *
 * O que não se perde na troca: `htmlFor` liga o rótulo ao campo,
 * `aria-describedby` liga a recusa, `aria-invalid` marca o campo, e a frase
 * leva `role="alert"` — os quatro que a moldura do design system daria.
 *
 * ## O que esta caixa não faz
 *
 * Não valida o código contra lista nenhuma, não sabe quais cupons existem e
 * não calcula desconto. Ela manda o código para `POST /cart/quote` e desenha
 * o que voltou. Quem decide se o cupom vale, quanto ele tira e por que não
 * pegou e o servidor, em um lugar só — o mesmo que a criação do pedido
 * consulta antes de gravar.
 */

export interface CouponBoxProps {
  state: CouponState;
  /** O subtotal desta sacola: e contra ele que se mede o alcance do cupom. */
  subtotalCents: number;
  onApply: (code: string) => void;
}

export function CouponBox({ state, subtotalCents, onApply }: CouponBoxProps) {
  const fieldId = useId();
  const reasonId = `${fieldId}-reason`;

  /**
   * O rascunho mora aqui, e não no store do checkout.
   *
   * O store guarda o cupom **aplicado**, que entra na chave da cotação. Um
   * rascunho lá faria `BL`, `BLA`, `BLAC` e `BLACK` virarem quatro idas ao
   * servidor, cada uma respondendo "esse cupom não e válido" embaixo de quem
   * ainda esta no meio da palavra.
   *
   * Nasce com o código que já esta em jogo: quem tira o cupom encontra o
   * campo com o que estava escrito, em vez de um campo vazio e a obrigação de
   * digitar tudo de novo.
   */
  const [draft, setDraft] = useState(() => codeOf(state));

  const applied = state.kind === 'applied' ? state.coupon : null;
  const reason = state.kind === 'refused' ? state.reason : '';
  const reach = applied === null ? '' : couponReachLabel(applied, subtotalCents);

  const submit = (): void => {
    if (applied !== null) {
      onApply('');
      return;
    }

    if (canSubmitCoupon(draft)) {
      onApply(normalizeCouponCode(draft));
    }
  };

  return (
    <form
      className={styles.box}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {applied === null ? (
        <label htmlFor={fieldId} className={styles.label}>
          Cupom de desconto
        </label>
      ) : (
        <p className={styles.label}>Cupom aplicado</p>
      )}

      <div className={styles.row}>
        {applied === null ? (
          <Input
            id={fieldId}
            className={styles.field}
            inputClassName={styles.code}
            value={draft}
            maxLength={COUPON_CODE_MAX}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="Digite o código"
            aria-invalid={reason === '' ? undefined : true}
            aria-describedby={reason === '' ? undefined : reasonId}
            onChange={(event) => {
              setDraft(normalizeCouponCode(event.target.value));
            }}
          />
        ) : (
          /* `<output>` e região viva por natureza: aplicar o cupom anuncia
             "BLACKFRIDAY · 20% OFF" sem nenhum `aria-live` escrito a mão, e
             sem que o foco precise ser mandado para lá. */
          <output className={styles.applied}>
            <CheckIcon className={styles.check} aria-hidden="true" />

            <span className={styles.appliedCode}>{applied.code}</span>
          </output>
        )}

        {/*
          O mesmo botão nos dois estados, na mesma posição da árvore.

          Trocar o rótulo em vez de trocar o botão e o que mantem o foco no
          lugar quando o campo ao lado da vez a confirmação.
        */}
        <Button
          type="submit"
          variant="secondary"
          className={styles.action}
          disabled={applied === null && !canSubmitCoupon(draft)}
        >
          {applied === null ? 'Aplicar' : 'Tirar'}
        </Button>
      </div>

      {reason === '' ? null : (
        <p id={reasonId} className={styles.reason} role="alert">
          {reason}
        </p>
      )}

      {applied === null ? null : (
        <p className={styles.campaign}>
          <span>
            {applied.title}
            <span className={styles.terms}>{applied.discountLabel}</span>
          </span>

          {reach === '' ? null : <span className={styles.reach}>{reach}</span>}
        </p>
      )}
    </form>
  );
}

/** O código em jogo, para o campo nascer com ele depois de um "Tirar". */
function codeOf(state: CouponState): string {
  switch (state.kind) {
    case 'applied':
      return state.coupon.code;

    case 'checking':
    case 'refused':
      return state.code;

    case 'none':
      return '';
  }
}
