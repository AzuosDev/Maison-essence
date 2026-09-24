import { z } from 'zod';
import { normalizePhone } from '@/lib/format';
import { FULFILLMENT_MODES, PAYMENT_METHODS } from './checkout.types';

/**
 * As regras de cada etapa, uma a uma.
 *
 * Um esquema por etapa, e não um esquema do checkout inteiro. A diferença
 * aparece na tela: quem esta escolhendo a cidade não pode ser barrado por
 * ainda não ter digitado o telefone — e um esquema único, validado no fim,
 * produziria exatamente isso. Aqui cada passo responde só pelo que pediu, e
 * o passo seguinte só abre quando o anterior fechou.
 *
 * ## Por que as mensagens estão aqui, e não no componente
 *
 * Elas são a validação. Separar a regra ("o bairro e obrigatório") do texto
 * ("Informe o bairro.") garante que um dia a regra mude e o texto continue
 * dizendo o que valia antes. Escritas juntas, mudam juntas.
 *
 * As mensagens nomeiam o campo e o que falta, e nunca dizem só "inválido":
 * quem lê "Informe um celular com DDD, como (88) 99999-9999" sabe o que
 * corrigir sem adivinhar o formato.
 *
 * ## Onde elas aparecem
 *
 * No campo, via `fieldErrors`, que achata os caminhos do Zod em chaves de um
 * nível — `address.street` — para o componente procurar a mensagem do campo
 * que esta desenhando. Nenhum passo abre um alerta genérico nem empilha um
 * "corrija os erros" acima do formulário: o erro pertence ao campo que o
 * produziu, e e lá que quem esta preenchendo esta olhando.
 */

/** A mensagem de cada campo, pela chave achatada do caminho do Zod. */
export type FieldErrors = Readonly<Record<string, string | undefined>>;

/** Nenhum erro. Uma constante para o estado inicial não alocar um objeto. */
export const NO_ERRORS: FieldErrors = {};

/**
 * Os erros do Zod, achatados por campo.
 *
 * A **primeira** mensagem de cada caminho vence: um campo com duas regras
 * quebradas mostra a mais específica, que e a que o Zod avalia primeiro, em
 * vez de empilhar duas linhas embaixo de um mesmo campo.
 */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.');

    errors[key] ??= issue.message;
  }

  return errors;
}

/* ---- Etapa 1: os itens ---------------------------------------------------
 *
 * A etapa não tem campo, e ainda assim tem regra: sacola vazia não fecha
 * pedido, e item que a cotação marcou como indisponível precisa sair antes.
 * O botão já nasce desabilitado nos dois casos — este esquema e o que
 * mantem a regra de pé se um dia o botão for habilitado por outro caminho.
 */

export const itemsSchema = z.object({
  items: z
    .array(z.object({ unavailable: z.boolean() }))
    .min(1, 'Sua sacola esta vazia.')
    .refine(
      (items) => items.every((item) => !item.unavailable),
      'Remova os itens indisponíveis para continuar.',
    ),
});

/* ---- Etapa 2: entrega ou retirada ---------------------------------------- */

/**
 * O endereço de entrega.
 *
 * Os limites são os mesmos de `OrderAddressDto` no backend, campo por campo,
 * e a igualdade e o ponto: uma rua de 200 caracteres aceita aqui seria
 * recusada lá, no último clique, depois de o cliente ter atravessado o
 * checkout inteiro.
 *
 * Rua e bairro são obrigatórios; número, complemento e ponto de referência
 * não. Endereço sem número existe — "s/n" e resposta legitima — e exigi-lo
 * só produziria um campo preenchido com um tracinho.
 */
export const addressSchema = z.object({
  street: z.string().trim().min(3, 'Informe a rua.').max(160, 'Rua longa demais.'),
  number: z.string().trim().max(20, 'Número longo demais.'),
  complement: z.string().trim().max(80, 'Complemento longo demais.'),
  district: z.string().trim().min(2, 'Informe o bairro.').max(80, 'Bairro longo demais.'),
  reference: z.string().trim().max(200, 'Ponto de referência longo demais.'),
});

/**
 * A etapa inteira, que muda de forma conforme o modo escolhido.
 *
 * `superRefine` em vez de `discriminatedUnion` porque o estado guardado e um
 * só: quem experimenta a entrega, digita o endereço e volta para a retirada
 * não deve perder o que escreveu — e uma união descartaria os campos do
 * outro lado a cada troca. O endereço continua guardado, apenas sem ser
 * cobrado.
 *
 * **Retirada não valida endereço nenhum.** E o critério de aceite escrito
 * como código: escolher retirar na loja tira os campos da tela e, aqui, tira
 * a exigência junto. Um deles sem o outro seria um formulário que recusa por
 * um campo que ninguém consegue ver.
 */
export const fulfillmentSchema = z
  .object({
    mode: z.enum(FULFILLMENT_MODES).nullable(),
    cityId: z.string(),
    address: z.object({
      street: z.string(),
      number: z.string(),
      complement: z.string(),
      district: z.string(),
      reference: z.string(),
    }),
  })
  .superRefine((value, ctx) => {
    if (value.mode === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['mode'],
        message: 'Escolha como quer receber o pedido.',
      });

      return;
    }

    if (value.mode === FULFILLMENT_MODES.PICKUP) {
      return;
    }

    if (value.cityId === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['cityId'],
        message: 'Escolha a cidade da entrega.',
      });
    }

    const address = addressSchema.safeParse(value.address);

    if (!address.success) {
      for (const issue of address.error.issues) {
        // O caminho ganha o prefixo do objeto: o componente procura a
        // mensagem por `address.street`, que e onde o campo esta.
        ctx.addIssue({ code: 'custom', path: ['address', ...issue.path], message: issue.message });
      }
    }
  });

/* ---- Etapa 3: pagamento --------------------------------------------------- */

/**
 * A forma de pagamento e, no cartão, em quantas vezes.
 *
 * `offered` não e um campo do formulário: são os parcelamentos que a
 * **cotação** devolveu, e entram no esquema porque são a regra. O total
 * muda, a lista de parcelas muda junto, e a opção de 10x que existia dois
 * cliques atrás pode não existir mais — validar contra uma lista fixa
 * escrita no navegador seria aceitar aqui o que o servidor recusa depois.
 *
 * Lista vazia não reprova ninguém: e o estado de quem escolheu PIX, e
 * também o de quem ainda espera a primeira cotação responder.
 */
export const paymentSchema = z
  .object({
    method: z.enum(PAYMENT_METHODS).nullable(),
    installments: z.number().int().min(1),
    offered: z.array(z.number().int()),
  })
  .superRefine((value, ctx) => {
    if (value.method === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['method'],
        message: 'Escolha a forma de pagamento.',
      });

      return;
    }

    if (
      value.method === PAYMENT_METHODS.CARD &&
      value.offered.length > 0 &&
      !value.offered.includes(value.installments)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['installments'],
        message: 'Escolha em quantas vezes quer pagar.',
      });
    }
  });

/* ---- Etapa 4: os dados de quem compra ------------------------------------- */

/**
 * Nome e WhatsApp.
 *
 * A regra do telefone e `normalizePhone`, a mesma função que a máscara usa e
 * a mesma que o backend aplica em `orders/phone.ts`. Três validações
 * parecidas escritas em três lugares divergem no dia em que o formato mudar;
 * uma função só, usada pelas três, não tem como.
 */
export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(120, 'Nome longo demais.'),
  phone: z
    .string()
    .refine(
      (value) => normalizePhone(value) !== null,
      'Informe um celular com DDD, como (88) 99999-9999.',
    ),
});
