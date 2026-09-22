import { useState, type CSSProperties } from 'react';
import { formatCents } from '@/lib/format';
import styles from './price-range.module.css';

/**
 * A faixa de preco: dois controles deslizantes sobre um trilho so.
 *
 * ## Por que dois `<input type="range">` nativos
 *
 * Um slider duplo desenhado a mao precisa reimplementar arrasto, toque,
 * teclado, foco e anuncio — e costuma errar em pelo menos um. Dois ranges
 * nativos empilhados entregam tudo isso de graca: seta anda um passo,
 * Home e End vao aos extremos, o leitor de tela anuncia o valor, e o alvo
 * de toque e o que o sistema operacional definiu.
 *
 * O preco e o empilhamento: o trilho e um so na tela, mas sao dois
 * elementos. O truque esta no CSS — os dois inputs ficam transparentes e
 * sem altura de trilho, e so as bolinhas recebem eventos.
 *
 * ## Quando o filtro e aplicado
 *
 * No fim do gesto, e nao durante. Arrastar dispara uma dezena de eventos por
 * segundo; aplicar em cada um significaria uma entrada no historico do
 * navegador e uma requisicao por pixel. O valor local acompanha o dedo, e a
 * viagem ate a URL acontece quando o cliente solta — ou tira o foco, ou
 * larga a tecla.
 *
 * ## As pontas nao se cruzam
 *
 * O minimo para um passo antes do maximo, e vice-versa. Sem isso, arrastar a
 * ponta esquerda alem da direita produz uma faixa invertida, que o backend
 * obedeceria respondendo zero produtos.
 */

/** O passo do slider, em reais. Centavo em filtro de vitrine e ruido. */
const STEP_REAIS = 10;

export interface PriceRangeProps {
  /** O piso escolhido, em centavos. `null` e "sem piso". */
  minCents: number | null;
  maxCents: number | null;
  /** O maior preco do catalogo neste contexto, em centavos. */
  ceilingCents: number;
  /** Chamado no fim do gesto, com a faixa ja em ordem. */
  onCommit: (minCents: number | null, maxCents: number | null) => void;
}

export function PriceRange({ minCents, maxCents, ceilingCents, onCommit }: PriceRangeProps) {
  const top = ceilingReais(ceilingCents);
  const bounds: Bounds = { top };

  const [range, setRange] = useState<Range>(() => rangeFrom(minCents, maxCents, bounds));

  // O estado local volta a seguir as propriedades quando elas mudam por fora
  // — "limpar filtros", ou o botao de voltar do navegador. Ajustado durante
  // o render, comparando com o que ja foi aplicado, e nao por efeito: o
  // efeito reporia os valores um quadro depois, e o slider piscaria no lugar
  // antigo.
  const signature = `${String(minCents)}:${String(maxCents)}:${String(top)}`;
  const [applied, setApplied] = useState(signature);

  if (applied !== signature) {
    setApplied(signature);
    setRange(rangeFrom(minCents, maxCents, bounds));
  }

  const commit = (): void => {
    // Ponta encostada no extremo quer dizer "sem limite deste lado", e vira
    // ausencia na URL em vez de `min=0` — o link fica mais curto e o backend
    // recebe um filtro a menos.
    onCommit(range.from === 0 ? null : range.from * 100, range.to === top ? null : range.to * 100);
  };

  const fill = {
    '--from': `${percent(range.from, top)}%`,
    '--to': `${percent(range.to, top)}%`,
  } as CSSProperties;

  return (
    <div className={styles.field}>
      <div className={styles.values} aria-hidden="true">
        <span className="tabular">{formatCents(range.from * 100)}</span>
        <span className="tabular">
          {range.to === top ? `${formatCents(top * 100)}+` : formatCents(range.to * 100)}
        </span>
      </div>

      <div className={styles.track} style={fill}>
        <span className={styles.fill} aria-hidden="true" />

        <input
          type="range"
          className={styles.input}
          min={0}
          max={top}
          step={STEP_REAIS}
          value={range.from}
          aria-label="Preco minimo"
          // O valor cru e um numero solto; sem isto o leitor de tela anuncia
          // "cento e vinte" e nao "cento e vinte reais".
          aria-valuetext={formatCents(range.from * 100)}
          onChange={(event) => {
            setRange(withFrom(range, Number(event.target.value), bounds));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />

        <input
          type="range"
          className={styles.input}
          min={0}
          max={top}
          step={STEP_REAIS}
          value={range.to}
          aria-label="Preco maximo"
          aria-valuetext={formatCents(range.to * 100)}
          onChange={(event) => {
            setRange(withTo(range, Number(event.target.value), bounds));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </div>
    </div>
  );
}

/** A faixa em reais cheios, que e a unidade em que o slider trabalha. */
interface Range {
  from: number;
  to: number;
}

interface Bounds {
  top: number;
}

function rangeFrom(minCents: number | null, maxCents: number | null, bounds: Bounds): Range {
  return {
    from: minCents === null ? 0 : clamp(Math.round(minCents / 100), 0, bounds.top),
    to: maxCents === null ? bounds.top : clamp(Math.round(maxCents / 100), 0, bounds.top),
  };
}

function withFrom(range: Range, value: number, bounds: Bounds): Range {
  return { ...range, from: clamp(value, 0, Math.min(range.to - STEP_REAIS, bounds.top)) };
}

function withTo(range: Range, value: number, bounds: Bounds): Range {
  return { ...range, to: clamp(value, Math.max(range.from + STEP_REAIS, 0), bounds.top) };
}

/**
 * O teto do slider: o maior preco do catalogo, arredondado para cima.
 *
 * Arredondar para o passo importa: com teto em R$ 1.847, a ponta direita
 * nunca alcancaria o produto mais caro, porque o passo de dez a faria parar
 * em R$ 1.840 — e o cliente veria o filtro esconder um produto que ele nao
 * pediu para esconder.
 *
 * O minimo de um passo existe para o catalogo vazio, em que o teto chega
 * zerado: um `<input type="range">` com `min` igual a `max` fica travado.
 */
function ceilingReais(ceilingCents: number): number {
  const reais = Math.ceil(ceilingCents / 100 / STEP_REAIS) * STEP_REAIS;

  return Math.max(reais, STEP_REAIS * 2);
}

function percent(value: number, top: number): number {
  return top === 0 ? 0 : (value / top) * 100;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
