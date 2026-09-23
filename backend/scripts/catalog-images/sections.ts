export interface CategoryLike {
  slug: string;
  name: string;
  parentSlug: string | null;
}

const GENDER_WORDS = new Map<string, string>([
  ['masculino', 'masculino'],
  ['masculinos', 'masculino'],
  ['masculina', 'masculino'],
  ['masculinas', 'masculino'],
  ['feminino', 'feminino'],
  ['femininos', 'feminino'],
  ['feminina', 'feminino'],
  ['femininas', 'feminino'],
]);

/**
 * Uma palavra comum demais para servir de pista de secao ("de", "e", "25"),
 * ou uma palavra do nome formal da categoria que nunca aparece no titulo
 * impresso no catalogo ("corporal": a categoria e "Hidratante Corporal
 * Masculino", mas a pagina so diz "HIDRATANTE MASCULINO"). Sem tirar essas
 * palavras do vocabulario, "Hidratante Masculino" e "Pasta Hidratante
 * Masculino" empatam no Jaccard — as duas tem uma palavra a mais que o titulo
 * nao tem, so que uma delas ("corporal") nunca vai ter mesmo.
 */
const STOPWORDS = new Set(['de', 'da', 'do', 'e', 'ml', 'corporal']);

/** Minusculo, sem acento, sem digitos colados, singular na marra (tira o "s" final). */
function normalizeWord(word: string): string {
  const bare = word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  return bare.length > 4 && bare.endsWith('s') ? bare.slice(0, -1) : bare;
}

/** As palavras de um texto, sem pontuacao, numeros isolados e palavras vazias. */
export function tokensOf(text: string): Set<string> {
  const words = text
    .split(/[^\p{L}]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length > 0)
    .map(normalizeWord)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));

  return new Set(words);
}

const EMPTY_TOPIC: ReadonlySet<string> = new Set();

function intersection(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  return [...a].filter((word) => b.has(word));
}

function countNotIn(words: readonly string[], exclude: ReadonlySet<string>): number {
  return words.filter((word) => !exclude.has(word)).length;
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const word of a) {
    if (b.has(word)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;

  return union === 0 ? 0 : intersection / union;
}

/** Tokens de uma categoria, com a palavra de genero separada do resto (o "assunto"). */
interface CategoryTokens {
  category: CategoryLike;
  topic: Set<string>;
  gender: string | null;
}

function splitTokens(name: string): { topic: Set<string>; gender: string | null } {
  const all = tokensOf(name);
  let gender: string | null = null;
  const topic = new Set<string>();

  for (const word of all) {
    const asGender = GENDER_WORDS.get(word);

    if (asGender !== undefined && gender === null) {
      gender = asGender;
    } else if (asGender === undefined) {
      topic.add(word);
    }
  }

  return { topic, gender };
}

/** Score minimo de Jaccard para aceitar um titulo como pista de secao. */
const MIN_SECTION_SCORE = 0.2;

/**
 * Acompanha, pagina apos pagina, qual categoria do catalogo o texto esta
 * descrevendo — sem depender de "pagina de capa" como um tipo de pagina a
 * parte. Qualquer bloco de texto entra: um titulo de secao move o assunto
 * ("BODY SPLASH", "HIDRATANTE"), um genero isolado ("MASCULINOS") move so o
 * genero, e um nome de produto ("ASAD") nao move nada porque nao aparece no
 * vocabulario de nenhuma categoria.
 *
 * O estado persiste entre paginas de proposito: a pagina de capa de uma
 * secao ("DESODORANTES ARABES") e as paginas de grade que vem depois nao tem
 * o mesmo titulo repetido — a capa e a unica vez que ele aparece.
 */
export class SectionTracker {
  private topic = new Set<string>();
  private gender: string | null = null;

  constructor(private readonly categories: readonly CategoryLike[]) {}

  /** Atualiza o estado com mais um bloco de texto, na ordem em que aparece na pagina. */
  observe(text: string): void {
    const tokens = tokensOf(text);

    if (tokens.size === 1) {
      const [only] = tokens;
      const asGender = GENDER_WORDS.get(only!);

      if (asGender !== undefined) {
        this.gender = asGender;

        return;
      }
    }

    const { topic, gender } = splitTokens(text);

    if (topic.size === 0) {
      return;
    }

    const best = this.bestCategoryFor(topic, gender, this.topic);

    if (best === null || best.score < MIN_SECTION_SCORE) {
      return;
    }

    // Adota o vocabulario DA CATEGORIA VENCEDORA, nao o do titulo inteiro.
    // "ARABES DESODORANTES" bate melhor com a categoria "desodorantes" (que
    // so precisa da palavra "desodorante"), mas guardar as duas palavras do
    // titulo como assunto ("arabe" e "desodorante" juntos) deixaria toda
    // resolucao seguinte empatada entre as duas secoes — o assunto precisa
    // ser so o que aquela categoria realmente significa.
    this.topic = best.topic;

    if (gender !== null) {
      this.gender = gender;
    }
  }

  /** A categoria que o estado atual melhor descreve, ou `null` se nada bateu ainda. */
  resolve(): CategoryLike | null {
    const best = this.bestCategoryFor(this.topic, this.gender);

    return best?.category ?? null;
  }

  private bestCategoryFor(
    topic: ReadonlySet<string>,
    gender: string | null,
    previousTopic: ReadonlySet<string> = EMPTY_TOPIC,
  ): { category: CategoryLike; topic: Set<string>; score: number } | null {
    if (topic.size === 0) {
      return null;
    }

    let best: { category: CategoryLike; topic: Set<string>; score: number } | null = null;

    for (const category of this.categoryTokens()) {
      // Genero incompativel descarta a categoria de uma vez: "MASCULINOS" no
      // estado nunca deve resolver para "Hidratante Corporal Feminino", por
      // mais que o resto do assunto bata.
      if (gender !== null && category.gender !== null && category.gender !== gender) {
        continue;
      }

      // Um titulo pode citar mais de um assunto real ao mesmo tempo ("ARABES
      // DESODORANTES", virando de arabes para desodorantes): o Jaccard sozinho
      // empata as duas categorias, porque cada uma bate com exatamente uma das
      // palavras. O desempate: prefira a categoria cuja palavra em comum e
      // NOVA (nao estava no assunto anterior) — um titulo raramente reanuncia
      // a secao em que a pagina ja estava.
      const novelty = countNotIn(intersection(topic, category.topic), previousTopic);
      // Empate entre a categoria-raiz e uma filha dela (a raiz "Desodorantes"
      // e a folha "Desodorante Masculino" batem igual quando o genero ja foi
      // dito por uma faixa separada): a folha e sempre a resposta mais util,
      // porque e nela que os produtos de fato estao.
      const leafBonus = category.category.parentSlug !== null ? 0.005 : 0;
      const score = jaccard(topic, category.topic) + novelty * 0.01 + leafBonus;

      if (best === null || score > best.score) {
        best = { category: category.category, topic: category.topic, score };
      }
    }

    return best;
  }

  private categoryTokensCache: CategoryTokens[] | null = null;

  private categoryTokens(): CategoryTokens[] {
    this.categoryTokensCache ??= this.categories.map((category) => {
      const { topic, gender } = splitTokens(category.name);

      return { category, topic, gender };
    });

    return this.categoryTokensCache;
  }
}
