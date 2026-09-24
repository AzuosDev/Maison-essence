import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  defaultVariant,
  galleryOf,
  imageIndexOf,
  variantById,
  type PublicProductDetail,
  type PublicVariant,
} from '@/features/catalog';

/**
 * O que o cliente escolheu nesta página: a variante e a foto.
 *
 * As duas escolhas moram em lugares diferentes de propósito, e a diferença e
 * o que o cliente faz com cada uma.
 *
 * ## A variante mora na URL
 *
 * Porque ela e a página. Um link para os 100ml precisa abrir nos 100ml —
 * no WhatsApp, no favorito, na aba restaurada, no resultado do Google (o
 * JSON-LD já manda uma oferta por variante, cada uma com o seu endereço). E
 * o mesmo motivo pelo qual `?variante=` não pode ser um detalhe de
 * implementação guardado em estado: estado não se compartilha.
 *
 * A troca entra por `replace`, e não empilha histórico. Experimentar três
 * tamanhos antes de decidir são três reescritas do mesmo endereço; com
 * `push`, o botão Voltar levaria o cliente pelos tamanhos que ele já
 * descartou em vez de devolve-lo a vitrine de onde veio.
 *
 * ## A foto mora em estado
 *
 * Porque e leitura, e não escolha: ninguém compartilha "a terceira foto".
 *
 * ## O encontro dos dois
 *
 * Escolher uma variante **com foto própria** troca a foto principal. Quando
 * ela não tem foto própria, a galeria fica onde estava — trocar de 50ml para
 * 100ml num produto fotografado uma vez só não pode jogar o cliente de volta
 * a primeira foto enquanto ele olhava a terceira. Quem responde isso e
 * `imageIndexOf`, com `null` significando "não mexa".
 *
 * O ajuste acontece no render, comparando com a variante já aplicada, e não
 * por efeito: por efeito, a tela desenharia um quadro com a foto antiga ao
 * lado do preço novo.
 */

/** O nome do parâmetro na URL. Em português, como o resto dos endereços. */
export const VARIANT_PARAM = 'variante';

export interface ProductSelection {
  /** A variante em foco. `null` quando o produto ficou sem nenhuma ativa. */
  variant: PublicVariant | null;
  /** As fotos da galeria, já sem repetição. */
  gallery: string[];
  /** A foto em exibição, sempre dentro da galeria. */
  imageIndex: number;
  selectVariant: (variantId: string) => void;
  showImage: (index: number) => void;
}

export function useProductSelection(product: PublicProductDetail): ProductSelection {
  const [params, setParams] = useSearchParams();

  const gallery = useMemo(() => galleryOf(product), [product]);

  // O id pedido pela URL vale quando este produto tem essa variante. Um link
  // antigo, de uma opção que a dona removeu, cai na variante padrão — que e a
  // mais barata disponível — em vez de deixar a página sem preço.
  const requested = params.get(VARIANT_PARAM) ?? '';
  const variant = variantById(product, requested) ?? defaultVariant(product);
  const variantId = variant?.id ?? '';

  // A primeira foto sai da variante que a URL pediu, e não da capa. Começar
  // em zero e corrigir depois não funcionaria: a reconciliação abaixo só
  // dispara quando a variante *muda*, e num link que já chega com
  // `?variante=` ela nunca mudou — o cliente abriria o link dos 100ml
  // olhando para o frasco de 50ml.
  const [requestedIndex, setIndex] = useState(() => imageIndexOf(gallery, variant) ?? 0);
  const [applied, setApplied] = useState(variantId);

  if (applied !== variantId) {
    setApplied(variantId);

    const wanted = imageIndexOf(gallery, variant);

    if (wanted !== null) {
      setIndex(wanted);
    }
  }

  // A galeria pode ter encolhido debaixo do índice — a consulta revalidou e a
  // dona apagou uma foto. Corrigido aqui, e não por efeito, pelo mesmo motivo
  // de sempre: um quadro apontando para uma foto que não existe mais e um
  // quadro com a moldura vazia.
  const imageIndex = requestedIndex < gallery.length ? requestedIndex : 0;

  const selectVariant = (id: string): void => {
    const next = new URLSearchParams(params);

    next.set(VARIANT_PARAM, id);
    setParams(next, { replace: true });
  };

  return { variant, gallery, imageIndex, selectVariant, showImage: setIndex };
}
