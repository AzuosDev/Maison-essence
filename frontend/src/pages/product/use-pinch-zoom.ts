import { useCallback, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

/**
 * A pinca na foto do produto, no celular.
 *
 * Quem compra perfume quer ver o rotulo, a tampa, o liquido. No desktop isso
 * e a lupa do cursor; no celular e o gesto que todo mundo ja conhece — dois
 * dedos afastando.
 *
 * ## Por que nao deixar o navegador fazer
 *
 * O pinch nativo amplia a **pagina** inteira: o cliente termina com o
 * cabecalho gigante, a coluna de compra fora da tela e sem saber como
 * voltar. O gesto tratado aqui amplia so a foto, dentro da moldura dela.
 *
 * ## `touch-action`, que e a parte que se erra
 *
 * Com a foto no tamanho normal, o elemento declara `pan-y`: a rolagem
 * vertical da pagina continua funcionando com um dedo — passar o dedo sobre
 * a foto para descer a pagina e o gesto mais comum de todos — e o pinch do
 * navegador fica desligado, que e justamente o que faz os eventos de dois
 * ponteiros chegarem ate aqui.
 *
 * Com a foto ampliada, passa a `none`: ai um dedo arrasta a foto por dentro
 * da moldura, e nao a pagina.
 *
 * ## O toque duplo
 *
 * Volta ao tamanho normal. E a saida que nao exige acertar o gesto inverso
 * com precisao, e e o que o cliente tenta primeiro.
 */

/** Ate onde a foto amplia. Tres vezes ja mostra a serigrafia do vidro. */
const MAX_SCALE = 3;

/** Abaixo disto, o gesto terminou perto do normal e encaixa no normal. */
const SNAP_BACK = 1.05;

interface Point {
  x: number;
  y: number;
}

export interface PinchZoom {
  /** A ampliacao atual. `1` e a foto no tamanho da moldura. */
  scale: number;
  zoomed: boolean;
  /** Vai no elemento da foto: a transformacao e o `touch-action` do momento. */
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

  // Os dedos em tela, por id. Um `Map` num `ref`, e nao estado: muda a cada
  // milimetro do gesto e nao desenha nada por si.
  const pointers = useRef(new Map<number, Point>());

  // A ampliacao tambem espelhada num `ref`. Os tratadores sao estaveis —
  // dependencias vazias — e precisam do valor de agora, nao do valor que
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

      // A ampliacao de agora e a base do gesto: dois pinches seguidos somam,
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

      // Um dedo so arrasta a foto, e apenas quando ha ampliacao para
      // arrastar. Sem essa condicao, o gesto roubaria a rolagem da pagina.
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

/** A distancia entre os dois primeiros dedos. */
function spread(pointers: ReadonlyMap<number, Point>): number {
  const [first, second] = [...pointers.values()];

  if (first === undefined || second === undefined) {
    return 0;
  }

  return Math.hypot(second.x - first.x, second.y - first.y);
}

/**
 * O deslocamento dentro do que a ampliacao permite.
 *
 * Sem isto, arrastar leva a foto para fora da moldura e deixa um retangulo
 * vazio no lugar dela — o cliente perde a foto e nao sabe como traze-la de
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
