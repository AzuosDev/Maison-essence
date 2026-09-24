import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

/**
 * A pinca na foto do produto, no celular.
 *
 * Quem compra perfume quer ver o rótulo, a tampa, o líquido. No desktop isso
 * e a lupa do cursor; no celular e o gesto que todo mundo já conhece — dois
 * dedos afastando.
 *
 * ## Por que não deixar o navegador fazer
 *
 * O pinch nativo amplia a **página** inteira: o cliente termina com o
 * cabeçalho gigante, a coluna de compra fora da tela e sem saber como
 * voltar. O gesto tratado aqui amplia só a foto, dentro da moldura dela.
 *
 * ## `touch-action`, que e a parte que se erra
 *
 * Com a foto no tamanho normal, o elemento declara `pan-y`: a rolagem
 * vertical da página continua funcionando com um dedo — passar o dedo sobre
 * a foto para descer a página e o gesto mais comum de todos — e o pinch do
 * navegador fica desligado, que e justamente o que faz os eventos de dois
 * ponteiros chegarem até aqui.
 *
 * Com a foto ampliada, passa a `none`: aí um dedo arrasta a foto por dentro
 * da moldura, e não a página.
 *
 * ## O toque duplo
 *
 * Volta ao tamanho normal. E a saída que não exige acertar o gesto inverso
 * com precisão, e e o que o cliente tenta primeiro.
 */

/** Até onde a foto amplia. Três vezes já mostra a serigrafia do vidro. */
const MAX_SCALE = 3;

/** Abaixo disto, o gesto terminou perto do normal e encaixa no normal. */
const SNAP_BACK = 1.05;

interface Point {
  x: number;
  y: number;
}

export interface PinchZoom {
  /** A ampliação atual. `1` e a foto no tamanho da moldura. */
  scale: number;
  zoomed: boolean;
  /** Vai no elemento da foto: a transformação e o `touch-action` do momento. */
  style: CSSProperties;
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
    onDoubleClick: () => void;
  };
  /** Volta ao tamanho normal. A galeria chama ao trocar de foto. */
  reset: () => void;
}

export function usePinchZoom(): PinchZoom {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  // Os dedos em tela, por id. Um `Map` num `ref`, e não estado: muda a cada
  // milímetro do gesto e não desenha nada por si.
  const pointers = useRef(new Map<number, Point>());

  // A ampliação também espelhada num `ref`. Os tratadores são estáveis —
  // dependências vazias — e precisam do valor de agora, não do valor que
  // existia quando foram criados.
  const scaleNow = useRef(1);
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const dragFrom = useRef<Point | null>(null);

  const applyScale = useCallback((next: number) => {
    scaleNow.current = next;
    setScale(next);
  }, []);

  const reset = useCallback(() => {
    applyScale(1);
    setOffset({ x: 0, y: 0 });
    pinch.current = null;
    dragFrom.current = null;
  }, [applyScale]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragFrom.current = { x: event.clientX, y: event.clientY };

    if (pointers.current.size === 2) {
      // A captura garante que o resto do gesto chegue aqui mesmo se o dedo
      // sair da foto no meio do caminho.
      event.currentTarget.setPointerCapture(event.pointerId);

      // A ampliação de agora e a base do gesto: dois pinches seguidos somam,
      // em vez de o segundo recomecar do tamanho normal.
      pinch.current = { distance: spread(pointers.current), scale: scaleNow.current };
    }
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!pointers.current.has(event.pointerId)) {
        return;
      }

      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const gesture = pinch.current;

      if (pointers.current.size >= 2 && gesture !== null && gesture.distance > 0) {
        applyScale(clamp((spread(pointers.current) / gesture.distance) * gesture.scale, 1, MAX_SCALE));

        return;
      }

      // Um dedo só arrasta a foto, e apenas quando há ampliação para
      // arrastar. Sem essa condição, o gesto roubaria a rolagem da página.
      const from = dragFrom.current;

      if (scaleNow.current > 1 && from !== null) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const moved = { x: event.clientX - from.x, y: event.clientY - from.y };

        dragFrom.current = { x: event.clientX, y: event.clientY };

        setOffset((current) =>
          limit({ x: current.x + moved.x, y: current.y + moved.y }, bounds, scaleNow.current),
        );
      }
    },
    [applyScale],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      pointers.current.delete(event.pointerId);
      dragFrom.current = null;

      if (pointers.current.size < 2) {
        pinch.current = null;
      }

      if (scaleNow.current < SNAP_BACK) {
        reset();
      }
    },
    [reset],
  );

  return {
    scale,
    zoomed: scale > 1,
    style: {
      transform: `translate3d(${String(offset.x)}px, ${String(offset.y)}px, 0) scale(${String(scale)})`,
      touchAction: scale > 1 ? 'none' : 'pan-y',
    },
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onDoubleClick: reset,
    },
    reset,
  };
}

/** A distância entre os dois primeiros dedos. */
function spread(pointers: ReadonlyMap<number, Point>): number {
  const [first, second] = [...pointers.values()];

  if (first === undefined || second === undefined) {
    return 0;
  }

  return Math.hypot(second.x - first.x, second.y - first.y);
}

/**
 * O deslocamento dentro do que a ampliação permite.
 *
 * Sem isto, arrastar leva a foto para fora da moldura e deixa um retângulo
 * vazio no lugar dela — o cliente perde a foto e não sabe como traze-lá de
 * volta.
 */
function limit(offset: Point, bounds: DOMRect, scale: number): Point {
  const maxX = (bounds.width * (scale - 1)) / 2;
  const maxY = (bounds.height * (scale - 1)) / 2;

  return { x: clamp(offset.x, -maxX, maxX), y: clamp(offset.y, -maxY, maxY) };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
