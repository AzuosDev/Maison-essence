import { ProductPicker } from './product-picker';

/**
 * Qual produto ocupa "O perfume da vez" na home.
 *
 * A mecânica de escolher — busca, linha do escolhido, troca — mora em
 * `ProductPicker`, que o brinde também usa. O que fica aqui são as palavras,
 * e elas não são enfeite: cada uma responde a uma pergunta que só existe
 * nesta seção.
 *
 * ## O escolhido fica na tela, inclusive quando esta fora do ar
 *
 * Produto despublicado continua escolhido aqui e **não** e o que a home
 * mostra: a seção cai no último destaque sozinha. E o único caso em que a
 * vitrine troca de produto sem ninguém pedir, e por isso ele e dito em voz
 * alta em vez de ser deduzido de um selo vermelho.
 *
 * ## A escolha vazia e um estado legitimo
 *
 * "Tirar a escolha" devolve a seção ao último produto marcado como destaque,
 * que e o padrão da loja. E dito com essas palavras, e não como "nenhum": a
 * seção continua na home de qualquer jeito.
 */
export interface PerfumePickerProps {
  /** O id escolhido, ou `null` para "vale o último destaque". */
  productId: string | null;
  onChange: (productId: string | null) => void;
}

export function PerfumePicker({ productId, onChange }: PerfumePickerProps) {
  return (
    <ProductPicker
      productId={productId}
      onChange={onChange}
      // Só o que esta publicado: produto fora do ar não desenha a seção na
      // home, e oferecê-lo aqui seria oferecer uma escolha que não acontece.
      publishedOnly
      copy={{
        unset: 'Sem escolha: a home mostra o último produto marcado como destaque.',
        gone: 'O produto escolhido não esta mais no cadastro. Escolha outro, ou tire a escolha para a home voltar ao destaque.',
        clear: 'Tirar a escolha',
        searchLabel: 'Trocar por outro produto',
        searchHint: 'Só produtos publicados aparecem na busca.',
        current: 'na home',
        offAir:
          'Enquanto este produto estiver fora do ar, a home mostra o último destaque no lugar dele.',
      }}
    />
  );
}
