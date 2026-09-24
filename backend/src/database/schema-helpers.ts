import type { Type } from '@nestjs/common';
import { SchemaFactory } from '@nestjs/mongoose';
import type {
  MongooseQueryOrDocumentMiddleware,
  Schema,
  SchemaTypeOptions,
} from 'mongoose';
import { SchemaTypes } from 'mongoose';

/**
 * Teto de qualquer campo monetario: R$ 999.999,99 em centavos.
 *
 * Existe para transformar erro de digitacao em erro de validacao. Sem teto,
 * um zero a mais no painel vira um pedido de um milhao de reais e so aparece
 * na mensagem do WhatsApp.
 */
export const MAX_CENTS = 99_999_999;

/**
 * Teto de tempo de qualquer consulta ao banco.
 *
 * A funcao serverless da Vercel tem tempo maximo de execucao, e uma consulta
 * pendurada nao volta com erro util: a funcao e cortada e quem chamou recebe
 * um 504 sem mensagem, sem log e sem pista do que travou. Com `maxTimeMS`, o
 * proprio servidor do Mongo aborta a operacao e devolve um erro nomeado, que
 * vira linha de log e resposta.
 *
 * Cinco segundos e folgado para tudo o que esta API faz — as consultas sao
 * indexadas e as colecoes sao pequenas — e ainda cabe com margem dentro do
 * teto da funcao. Consulta que passa disso esta errada, nao lenta.
 */
export const DB_MAX_TIME_MS = 5000;

/**
 * Operacoes de consulta que recebem o teto de tempo.
 *
 * Escrita de documento unico (`save`, `create`) fica de fora porque o
 * Mongoose nao expoe `maxTimeMS` nesse caminho — e o risco ali e outro: quem
 * pendura uma conexao e a varredura, nao o insert de um documento por `_id`.
 */
const TIMED_QUERIES: MongooseQueryOrDocumentMiddleware[] = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'estimatedDocumentCount',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
];

/**
 * `SchemaFactory.createForClass` com o comportamento que todo schema do
 * projeto precisa.
 *
 * Sao dois acrescimos, os dois por query e nao por documento.
 *
 * `runValidators`: o Mongoose nao valida `findOneAndUpdate` por padrao, entao
 * um `priceCents` decimal seria recusado no `save()` e aceito no `PATCH` do
 * painel — que e justamente o caminho que a dona usa todo dia.
 *
 * `maxTimeMS`: o teto de tempo (ver `DB_MAX_TIME_MS`). Fica aqui, e nao em
 * cada chamada, porque "toda consulta tem teto" so e verdade se ninguem
 * precisar lembrar — e todo schema do projeto nasce nesta funcao.
 */
export function createSchema<T>(target: Type<T>): Schema<T> {
  const schema = SchemaFactory.createForClass(target);

  schema.pre(TIMED_QUERIES, { document: false, query: true }, function () {
    this.setOptions({ maxTimeMS: DB_MAX_TIME_MS });
  });

  schema.pre(
    ['findOneAndUpdate', 'updateOne', 'updateMany'],
    { document: false, query: true },
    function () {
      this.setOptions({ runValidators: true });
    },
  );

  // A agregacao nao e uma query e tem a sua propria forma de receber opcoes.
  schema.pre('aggregate', function () {
    this.option({ maxTimeMS: DB_MAX_TIME_MS });
  });

  return schema;
}

interface TextPropOptions {
  /** Tamanho maximo. Obrigatorio: campo de texto sem teto e campo sem contrato. */
  max: number;
  required?: boolean;
  default?: string;
  lowercase?: boolean;
  uppercase?: boolean;
  /** Indice unico no proprio campo, para os casos em que o valor e a chave natural. */
  unique?: boolean;
  /** Ignora documentos sem o campo no indice unico. */
  sparse?: boolean;
  match?: [RegExp, string];
  /** Nao devolve o campo nas consultas, a menos que pedido explicitamente. */
  select?: boolean;
}

/**
 * Campo de texto exibivel: sempre com `trim` e sempre com tamanho maximo.
 *
 * O `trim` importa mais do que parece aqui: um espaco sobrando no fim do nome
 * do produto muda o slug gerado e quebra o link ja compartilhado.
 */
export function textProp(options: TextPropOptions): SchemaTypeOptions<string> {
  const { max, match, ...rest } = options;

  return {
    type: String,
    trim: true,
    maxlength: [max, `{PATH} deve ter no máximo ${max} caracteres`],
    ...(match ? { match } : {}),
    ...rest,
  };
}

interface EnumPropOptions<T extends string> {
  required?: boolean;
  default?: T;
  index?: boolean;
}

/**
 * Campo restrito a uma lista de valores. Recebe o array `readonly` dos objetos
 * const de `src/common/enums/` e o copia, porque o Mongoose guarda a referencia
 * e a mutaria se pudesse.
 */
export function enumProp<T extends string>(
  values: readonly T[],
  options: EnumPropOptions<T> = {},
): SchemaTypeOptions<string> {
  return {
    type: String,
    enum: {
      values: [...values],
      message: `{VALUE} não e um valor válido para {PATH}`,
    },
    ...options,
  };
}

interface IntegerPropOptions {
  min?: number;
  max?: number;
  required?: boolean;
  default?: number | null;
  /** Mensagem propria, para o erro falar a lingua do dominio. */
  message?: string;
}

/**
 * Campo numerico inteiro.
 *
 * A validacao e uma so, em vez de `min`/`max` nativos mais um validador de
 * inteiro, porque o Mongoose roda validador em valor `null` e os campos
 * opcionais entrariam em erro so por estarem vazios.
 */
export function integerProp(options: IntegerPropOptions = {}): SchemaTypeOptions<number> {
  const { min = 0, max = Number.MAX_SAFE_INTEGER, message, required, default: value } = options;

  return {
    type: Number,
    ...(required === undefined ? {} : { required }),
    ...(value === undefined ? {} : { default: value }),
    validate: {
      validator: (input: unknown): boolean => {
        if (input == null) {
          return true;
        }

        return typeof input === 'number' && Number.isInteger(input) && input >= min && input <= max;
      },
      message: message ?? `{PATH} deve ser um número inteiro entre ${min} e ${max}`,
    },
  };
}

/**
 * Valor monetario, sempre inteiro em centavos.
 *
 * Nenhum campo de dinheiro no projeto e decimal: R$ 199,90 se escreve `19990`.
 * Ponto flutuante acumula erro no parcelamento, onde o total e dividido e
 * somado de volta, e a soma precisa fechar no centavo.
 */
export function centsProp(
  options: Omit<IntegerPropOptions, 'message'> = {},
): SchemaTypeOptions<number> {
  const max = options.max ?? MAX_CENTS;

  return integerProp({
    ...options,
    max,
    message: `{PATH} deve ser um inteiro em centavos entre 0 e ${max} — R$ 199,90 se escreve 19990, nunca 199.90`,
  });
}

interface PercentPropOptions {
  required?: boolean;
  default?: number;
  min?: number;
  max?: number;
  /** Permite fracao. Usado so nos juros mensais, onde 1,99% e um valor legitimo. */
  fractional?: boolean;
}

/** Percentual de 0 a 100. Inteiro, salvo onde a fracao faz parte do negocio. */
export function percentProp(options: PercentPropOptions = {}): SchemaTypeOptions<number> {
  const { min = 0, max = 100, fractional = false, ...rest } = options;

  if (!fractional) {
    return integerProp({
      ...rest,
      min,
      max,
      message: `{PATH} deve ser um percentual inteiro entre ${min} e ${max}`,
    });
  }

  return {
    type: Number,
    ...rest,
    validate: {
      validator: (input: unknown): boolean =>
        input == null || (typeof input === 'number' && input >= min && input <= max),
      message: `{PATH} deve ser um percentual entre ${min} e ${max}`,
    },
  };
}

interface ObjectIdPropOptions {
  /** Nome do model referenciado. Omitido de proposito nos snapshots do pedido. */
  ref?: string;
  required?: boolean;
  index?: boolean;
  default?: null;
}

/** Referencia a outro documento. */
export function objectIdProp(options: ObjectIdPropOptions = {}): SchemaTypeOptions<unknown> {
  return {
    type: SchemaTypes.ObjectId,
    ...options,
  };
}
