import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Badge, Button } from '@/components/ui';
import {
  COUPON_STATUS_LABELS,
  copyToClipboard,
  couponScopeLabel,
  couponWindowLabel,
  type AdminCoupon,
} from '@/features/admin';
import { cx } from '@/lib/cx';
import { CheckIcon, CopyIcon, PencilIcon, PowerIcon, TrashIcon } from './admin-icons';
import { RowMenu, type RowMenuItem } from './row-menu';
import { UsesRuler } from './uses-ruler';
import styles from './coupon-card.module.css';

/**
 * Uma campanha, como a tela de cupons a mostra.
 *
 * ## Cartão e não linha de tabela
 *
 * Esta tela não se compara coluna a coluna como a de taxas: uma campanha tem
 * um código, um desconto, um prazo, um recorte de produtos e uma régua de usos
 * — cinco grandezas diferentes, e nenhuma delas se lê contra a da vizinha. O
 * que se faz aqui e olhar **uma** campanha e decidir sobre ela.
 *
 * ## A ordem das quatro linhas
 *
 * O código vem primeiro, e grande, porque e o que a dona dita no WhatsApp e o
 * que ela procura quando abre a tela. O nome da campanha vem abaixo, menor:
 * ele importa para a home, não para quem esta operando. Depois o prazo e o
 * recorte, na mesma linha, que são as duas perguntas de "isso ainda vale?". A
 * régua fecha, porque ela e a resposta que muda sozinha.
 *
 * ## "na home" e uma previsão, não um interruptor
 *
 * A home anuncia **uma** campanha: a que acaba primeiro entre as anunciáveis
 * no ar. Ligar o interruptor em três não põe três faixas lá. O selo dourado
 * marca a que de fato esta no ar, e a que esta na fila recebe a frase que
 * explica a espera — sem ela, a tarde vira uma procura por que a campanha
 * anunciada não aparece.
 */

export interface CouponCardProps {
  coupon: AdminCoupon;
  /** Esta e a campanha que a home esta anunciando agora. */
  announced: boolean;
  /** Liga e desliga a campanha sem abrir o cadastro. */
  onToggleActive: (coupon: AdminCoupon) => void;
  /** Ausente para quem não apaga: o item nem aparece no menu. */
  onDelete?: ((coupon: AdminCoupon) => void) | undefined;
  /** Mostra o verde de "salvo" por um instante depois da gravação. */
  saved?: boolean;
  busy?: boolean;
}

export function CouponCard({
  coupon,
  announced,
  onToggleActive,
  onDelete,
  saved = false,
  busy = false,
}: CouponCardProps) {
  const waiting = coupon.showOnHome && !announced && coupon.status === 'live';

  const items: RowMenuItem[] = [
    { label: 'Editar campanha', icon: PencilIcon, to: ROUTES.admin.coupon(coupon.id) },
    {
      label: coupon.isActive ? 'Desligar campanha' : 'Ligar campanha',
      icon: PowerIcon,
      onSelect: () => {
        onToggleActive(coupon);
      },
      disabled: busy,
    },
    ...(onDelete === undefined
      ? []
      : [
          {
            label: 'Excluir cupom',
            icon: TrashIcon,
            tone: 'danger' as const,
            separated: true,
            onSelect: () => {
              onDelete(coupon);
            },
          },
        ]),
  ];

  return (
    <article className={cx(styles.card, saved && styles.saved, !coupon.isActive && styles.off)}>
      <header className={styles.head}>
        <div className={styles.identity}>
          <h3 className={styles.code}>{coupon.code}</h3>
          <p className={styles.title}>{coupon.title}</p>
        </div>

        <div className={styles.flags}>
          <span className={cx(styles.discount, 'tabular')}>{coupon.discountLabel}</span>

          <Badge variant={toneOf(coupon)}>{COUPON_STATUS_LABELS[coupon.status]}</Badge>

          {announced ? <Badge variant="gold">na home</Badge> : null}
        </div>
      </header>

      <p className={styles.terms}>
        <span>{couponWindowLabel(coupon)}</span>
        <span className={styles.dot} aria-hidden="true" />
        <span>{couponScopeLabel(coupon)}</span>
      </p>

      <UsesRuler coupon={coupon} className={styles.uses} />

      {/*
        As duas frases que explicam um estado que confunde. Nenhuma das duas e
        decorativa: a primeira e a resposta para "esgotou, e agora?", e a
        segunda para "liguei o anúncio e não apareceu".
      */}
      {coupon.status === 'exhausted' ? (
        <p className={styles.note}>
          Todos os cupons foram usados e o código já não passa no fechamento. Aumente o limite para
          a campanha voltar a valer, ou encerre o período.
        </p>
      ) : null}

      {waiting ? (
        <p className={styles.note}>
          A home anuncia uma campanha por vez, a que termina primeiro. Esta entra quando a de agora
          sair do ar.
        </p>
      ) : null}

      <footer className={styles.actions}>
        <CopyCode code={coupon.code} />

        <Link to={ROUTES.admin.coupon(coupon.id)} className={styles.edit}>
          Editar
        </Link>

        {/* `RowMenu` já escreve "Ações de" no rótulo do botão. */}
        <RowMenu label={coupon.code} items={items} />
      </footer>
    </article>
  );
}

/** Quanto tempo o botão fica dizendo "Copiado". O mesmo da senha temporária. */
const FEEDBACK_MS = 2000;

/**
 * Copiar o código, que e o gesto mais frequente desta tela.
 *
 * A dona não digita `BLACKFRIDAY` na mensagem para a cliente: ela copia daqui
 * e cola no WhatsApp. O botão confirma que fez algo — sem isso ninguém sabe se
 * o clique pegou — e volta a "Copiar código" depois de dois segundos, porque
 * copiar de novo e comum depois de colar no lugar errado.
 *
 * A falha tem frase própria e vive num `<output>`: `navigator.clipboard` não
 * existe em contexto inseguro, e o painel aberto por IP na rede da loja e um
 * contexto inseguro. Ali o caminho e selecionar o código a mão, e a tela diz
 * isso em vez de ficar calada.
 */
function CopyCode({ code }: { code: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (state === 'idle') {
      return;
    }

    const timer = setTimeout(() => {
      setState('idle');
    }, FEEDBACK_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [state]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="small"
        className={styles.copy}
        onClick={() => {
          void copyToClipboard(code).then((ok) => {
            setState(ok ? 'copied' : 'failed');
          });
        }}
      >
        {state === 'copied' ? <CheckIcon /> : <CopyIcon />}
        {state === 'copied' ? 'Copiado' : 'Copiar código'}
      </Button>

      <output className={styles.copyStatus}>
        {state === 'failed' ? `Não foi possível copiar. O código e ${code}.` : ''}
      </output>
    </>
  );
}

/**
 * A cor do selo, pelo que o estado significa.
 *
 * Verde e promessa cumprida — a campanha esta valendo. Vermelho e
 * impedimento: esgotada recusa no fechamento. Tinta e informação, e cobre os
 * três estados que não pedem nada de ninguém agora.
 */
function toneOf(coupon: AdminCoupon): 'success' | 'danger' | 'ink' | 'muted' {
  if (coupon.status === 'live') {
    return 'success';
  }

  if (coupon.status === 'exhausted') {
    return 'danger';
  }

  return coupon.status === 'scheduled' ? 'ink' : 'muted';
}
