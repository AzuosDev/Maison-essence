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
 * O que o cliente escolheu nesta pagina: a variante e a foto.
 *
 * As duas escolhas moram em lugares diferentes de proposito, e a diferenca e
 * o que o cliente faz com cada uma.
 *
 * ## A variante mora na URL
 *
 * Porque ela e a pagina. Um link para os 100ml precisa abrir nos 100ml —
 * no WhatsApp, no favorito, na aba restaurada, no resultado do Google (o
 * JSON-LD ja manda uma oferta por variante, cada uma com o seu endereco). E
 * o mesmo motivo pelo qual `?variante=` nao pode ser um detalhe de
 * implementacao guardado em estado: estado nao se compartilha.
 *
 * A troca entra por `replace`, e nao empilha historico. Experimentar tres
 * tamanhos antes de decidir sao tres reescritas do mesmo endereco; com
 * `push`, o botao Voltar levaria o cliente pelos tamanhos que ele ja
 * descartou em vez de devolve-lo a vitrine de onde veio.
 *
 * ## A foto mora em estado
 *
 * Porque e leitura, e nao escolha: ninguem compartilha "a terceira foto".
 *
 * ## O encontro dos dois
 *
 * Escolher uma variante **com foto propria** troca a foto principal. Quando
 * ela nao tem foto propria, a galeria fica onde estava — trocar de 50ml para
 * 100ml num produto fotografado uma vez so nao pode jogar o cliente de volta
 * a primeira foto enquanto ele olhava a terceira. Quem responde isso e
 * `imageIndexOf`, com `null` significando "nao mexa".
 *
 * O ajuste acontece no render, comparando com a variante ja aplicada, e nao
 * por efeito: por efeito, a tela desenharia um quadro com a foto antiga ao
 * lado do preco novo.
 */

/** O nome do parametro na URL. Em portugues, como o resto dos enderecos. */
export const VARIANT_PARAM = 'variante';

export interface ProductSelection {
  /** A variante em foco. `null` quando o produto ficou sem nenhuma ativa. */
  variant: PublicVariant | null;
  /** As fotos da galeria, ja sem repeticao. */
  gallery: string[];
  /** A foto em exibicao, sempre dentro da galeria. */
  imageIndex: number;
  selectVariant: (variantId: string) => void;
  showImage: (index: number) => void;
}

export function useProductSelection(product: PublicProductDetail): ProductSelection {
  const [params, setParams] = useSearchParams();

  const gallery = useMemo(() => galleryOf(product), [product]);

  // O id pedido pela URL vale quando este produto tem essa variante. Um link
  // antigo, de uma opcao que a dona removeu, cai na variante padrao — que e a
  // mais barata disponivel — em vez de deixar a pagina sem preco.
  const requested = params.get(VARIANT_PARAM) ?? '';
  const variant = variantById(product, requested) ?? defaultVariant(product);
  const variantId = variant?.id ?? '';

  // A primeira foto sai da variante que a URL pediu, e nao da capa. Comecar
  // em zero e corrigir depois nao funcionaria: a reconciliacao abaixo so
  // dispara quando a variante *muda*, e num link que ja chega com
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

  // A galeria pode ter encolhido debaixo do indice — a consulta revalidou e a
  // dona apagou uma foto. Corrigido aqui, e nao por efeito, pelo mesmo motivo
  // de sempre: um quadro apontando para uma foto que nao existe mais e um
  // quadro com a moldura vazia.
  const imageIndex = requestedIndex < gallery.length ? requestedIndex : 0;

  const selectVariant = (id: string): void => {
    const next = new URLSearchParams(params);

    next.set(VARIANT_PARAM, id);
    setParams(next, { replace: true });
  };

  return { variant, gallery, imageIndex, selectVariant, showImage: setIndex };
}
