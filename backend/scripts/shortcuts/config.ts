import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');

/** De onde saem as fotos. O nome de cada arquivo casa com um atalho da lista. */
export const ART_DIR = resolve(HERE, 'art');

/**
 * A pasta da conta do Cloudinary.
 *
 * Separada de `categories` pelo mesmo motivo que `categories` e separada de
 * `products`: o ciclo de vida e outro. Foto de categoria some junto com a
 * categoria; foto de atalho e a arte da fileira da home, e ela troca quando a
 * dona muda a vitrine, mesmo que a categoria por tras continue de pe.
 */
export const CLOUDINARY_SHORTCUTS_FOLDER = 'maison-essence/shortcuts';

/** Um atalho da fileira, como ele sai deste script. */
export interface PlannedShortcut {
  /**
   * O nome do arquivo de foto, sem extensão e sem diferenciar maiúsculas.
   *
   * E por ele que a foto encontra o atalho. Casar por posição na pasta — como
   * o `banners:upload` faz — poria a foto de "Masculino" no círculo de
   * "Feminino" no dia em que alguém renomeasse um arquivo.
   */
  file: string;
  /** O nome embaixo do círculo, como a cliente o lê. */
  label: string;
  /** O slug da pasta no Cloudinary: `maison-essence/shortcuts/<slug>`. */
  slug: string;
  /** Para onde o atalho leva. */
  link: string;
}

/**
 * A fileira que a dona pediu, nesta ordem.
 *
 * Escrita aqui e não adivinhada da pasta porque ordem e destino são decisão
 * dela, e nome de arquivo não carrega nem uma coisa nem outra. Depois do
 * primeiro envio a lista e editada no painel, em Ajustes › Atalhos da home —
 * este arquivo e só o ponto de partida.
 *
 * Duas delas apontam para destinos que **podem não existir ainda** no
 * cadastro, e o script avisa quando for o caso em vez de gravar calado:
 *
 * - **Victoria's Secret** e marca, e nenhum produto do catálogo esta
 *   cadastrado com ela hoje. O círculo leva a vitrine filtrada, que fica
 *   vazia ate a dona escrever a marca no cadastro dos produtos dela;
 * - **Feminino** e **Masculino** são categorias que a arvore ainda não tem.
 *   O `--criar-categorias` as cria vazias, na raiz, e os produtos entram
 *   nelas pelo painel — classificar duzentos e sessenta frascos não e coisa
 *   que um script adivinha.
 */
export const SHORTCUTS: readonly PlannedShortcut[] = [
  {
    file: 'isabelle la belle',
    label: 'Isabelle La Belle',
    slug: 'isabelle-la-belle',
    link: `/produtos?marca=${encodeURIComponent('Isabelle La Belle')}`,
  },
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
  {
    file: 'feminino',
    label: 'Feminino',
    slug: 'feminino',
    link: '/categorias/feminino',
  },
  {
    file: 'masculino',
    label: 'Masculino',
    slug: 'masculino',
    link: '/categorias/masculino',
  },
  {
    file: 'body splash masculino',
    label: 'Body Splash Masculino',
    slug: 'body-splash-masculino',
    link: '/categorias/body-splash-masculino',
  },
  {
    /*
     * A foto chegou como "PASTAS ISABELLE LA BELLE" e o atalho se chama
     * "Hidratantes": a pasta hidratante e o produto que a foto mostra, e
     * `hidratantes` e a categoria que o reúne no cadastro. O nome do arquivo
     * descreve o que esta na imagem; o rótulo e o que a cliente procura.
     */
    file: 'pastas isabelle la belle',
    label: 'Hidratantes',
    slug: 'hidratantes',
    link: '/categorias/hidratantes',
  },
];

/** As categorias que a fileira precisa e que o cadastro pode não ter ainda. */
export const CATEGORY_PREFIX = '/categorias/';

/** O prefixo da vitrine filtrada por marca, para conferir se ela tem produto. */
export const BRAND_PREFIX = '/produtos?marca=';
