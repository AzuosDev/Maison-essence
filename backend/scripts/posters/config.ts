import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');

/** De onde saem as artes. O nome de cada arquivo casa com um cartaz da lista. */
export const ART_DIR = resolve(HERE, 'art');

/**
 * A pasta da conta do Cloudinary.
 *
 * Separada de `shortcuts` porque a arte e outra coisa: o circulo e um disco
 * de 600x600, o cartaz e uma paisagem 16:9. Misturar as duas na mesma pasta
 * faria a limpeza de orfaos de um script enxergar as artes do outro.
 */
export const CLOUDINARY_POSTERS_FOLDER = 'maison-essence/posters';

/** A proporcao que a moldura da home tem, fixa. */
export const POSTER_RATIO = 16 / 9;

/** A largura maxima que a entrega do Cloudinary pede. Ver `IMAGE_WIDTHS`. */
export const POSTER_MIN_WIDTH = 1200;

/** Um cartaz da faixa, como ele sai deste script. */
export interface PlannedPoster {
  /**
   * O nome do arquivo de arte, sem extensao e sem diferenciar maiusculas.
   *
   * E por ele que a arte encontra o cartaz — mesma regra do `shortcuts:upload`,
   * e pelo mesmo motivo: casar por posicao na pasta poria a arte de um no
   * outro no dia em que alguem renomeasse um arquivo.
   */
  file: string;
  /** O nome escrito sobre a arte, no pe do cartaz. */
  label: string;
  /** O slug da pasta no Cloudinary: `maison-essence/posters/<slug>`. */
  slug: string;
  /** Para onde o cartaz leva. */
  link: string;
  /**
   * A linha de apoio embaixo do nome.
   *
   * Vazia e o padrao, e e o que estes dois usam. Quando os cartazes saiam das
   * categorias esta linha era a contagem de produtos, que a API devolvia —
   * lista propria nao tem contagem para devolver, e inventar "38 produtos"
   * aqui seria um numero que ninguem atualiza.
   */
  caption?: string;
}

/**
 * A faixa que a dona pediu, nesta ordem.
 *
 * Os dois destinos sao os mesmos de dois circulos da fileira de atalhos, e
 * ainda assim as listas sao separadas: ver `CollectionPoster`, no backend. O
 * cartaz e o destaque do meio da pagina, e a fileira e a navegacao da
 * primeira tela — a dona pode querer mudar um sem mexer no outro.
 *
 * **Victoria's Secret** e marca, e o script avisa se nenhum produto do
 * catalogo estiver cadastrado com ela — o cartaz leva a vitrine filtrada, que
 * fica vazia ate alguem escrever a marca no cadastro.
 */
export const POSTERS: readonly PlannedPoster[] = [
  {
    file: "vitoria's secrets",
    label: "Victoria's Secret",
    slug: 'victorias-secret',
    link: `/produtos?marca=${encodeURIComponent("Victoria's Secret")}`,
  },
  {
    file: 'mais vendidos',
    label: 'Mais vendidos',
    slug: 'mais-vendidos',
    link: '/mais-vendidos',
  },
];

/** O prefixo da pagina de categoria, para conferir se ela existe. */
export const CATEGORY_PREFIX = '/categorias/';

/** O prefixo da vitrine filtrada por marca, para conferir se ela tem produto. */
export const BRAND_PREFIX = '/produtos?marca=';
