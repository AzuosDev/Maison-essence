import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  CHECKOUT_STEPS,
  EMPTY_ADDRESS,
  EMPTY_CONTACT,
  PAYMENT_METHODS,
  nextStep,
  previousStep,
  type CheckoutAddress,
  type CheckoutContact,
  type CheckoutStep,
  type FulfillmentMode,
  type PaymentMethod,
} from './checkout.types';

/**
 * O checkout em andamento, guardado no navegador.
 *
 * Existe por um criterio de aceite — "recarregar no meio do checkout nao
 * perde nada" — e esse criterio nao e capricho. O checkout e a tela onde o
 * cliente sai para conferir o CEP no aplicativo dos Correios, atende o
 * telefone, troca de aba e volta; no celular, trocar de aplicativo e o
 * suficiente para o navegador descartar a pagina. Um estado so em memoria
 * faria cada uma dessas idas apagar o endereco inteiro, e a pessoa recomeca
 * — ou desiste, que e o que costuma acontecer no quarto campo.
 *
 * ## O que atravessa o armazenamento
 *
 * Tudo o que o cliente **escolheu ou digitou**: a etapa em que parou, o modo
 * de entrega, a cidade, o endereco, a forma de pagamento, o parcelamento, o
 * nome e o WhatsApp.
 *
 * E nada mais. Nao ha total, nao ha taxa de entrega, nao ha valor de
 * parcela. A razao e a mesma que mantem preco fora da sacola: um total
 * gravado aqui sobrevive ao reajuste, a promocao que acabou e a taxa que a
 * dona mudou ontem, e volta intacto na tela de quem deixou a aba aberta
 * durante a noite — que leria um numero e pagaria outro. Todo valor em reais
 * desta tela vem de `POST /cart/quote`, refeito a cada mudanca de qualquer
 * campo daqui.
 *
 * ## Por que os campos ficam aqui, e nao num formulario
 *
 * O resto da loja valida com `react-hook-form`, e este nao. A diferenca e a
 * persistencia: o formulario mantem o proprio estado interno, e sincroniza-lo
 * com o armazenamento a cada tecla exigiria um efeito em cima do `watch` —
 * com a janela entre digitar e sincronizar sendo exatamente o instante em
 * que o celular descarta a aba. Com os campos no store, o que esta na tela e
 * o que esta guardado, sem intermediario. A validacao continua sendo Zod,
 * em `checkout.schema.ts`, rodada na hora de avancar.
 */

interface CheckoutState {
  /** Em qual das quatro etapas o cliente parou. */
  step: CheckoutStep;

  /** `null` ate ele escolher. Nao ha modo padrao: escolher e a etapa 2. */
  mode: FulfillmentMode | null;

  /** O id da cidade atendida. Vazio na retirada e antes da escolha. */
  cityId: string;

  /**
   * O endereco, que sobrevive a troca de modo.
   *
   * Quem digitou o endereco, experimentou a retirada e voltou para a entrega
   * encontra o que escreveu. Na retirada ele simplesmente nao e exigido nem
   * enviado — ver `fulfillmentSchema`.
   */
  address: CheckoutAddress;

  method: PaymentMethod | null;

  /** Sempre 1 no PIX, que nao parcela. */
  installments: number;

  contact: CheckoutContact;

  goTo: (step: CheckoutStep) => void;
  advance: () => void;
  goBack: () => void;

  chooseMode: (mode: FulfillmentMode) => void;
  chooseCity: (cityId: string) => void;
  /** Um campo do endereco por vez, como o `onChange` do campo entrega. */
  setAddressField: (field: keyof CheckoutAddress, value: string) => void;
  /** O endereco salvo da conta, aplicado de uma vez. */
  applySavedAddress: (address: CheckoutAddress, cityId: string) => void;

  chooseMethod: (method: PaymentMethod) => void;
  chooseInstallments: (installments: number) => void;

  setContactField: (field: keyof CheckoutContact, value: string) => void;

  /** Pedido fechado: o checkout volta ao inicio, sem rastro do anterior. */
  reset: () => void;
}

const INITIAL = {
  step: CHECKOUT_STEPS[0],
  mode: null,
  cityId: '',
  address: EMPTY_ADDRESS,
  method: null,
  installments: 1,
  contact: EMPTY_CONTACT,
} satisfies Partial<CheckoutState>;

export const useCheckout = create<CheckoutState>()(
  persist(
    (set) => ({
      ...INITIAL,

      goTo: (step) => {
        set({ step });
      },

      advance: () => {
        set((state) => ({ step: nextStep(state.step) }));
      },

      goBack: () => {
        set((state) => ({ step: previousStep(state.step) }));
      },

      chooseMode: (mode) => {
        // A cidade nao e apagada ao trocar para a retirada: quem volta para a
        // entrega encontra a que ja tinha escolhido. Quem manda na taxa e o
        // modo, e a cotacao so recebe a cidade quando o modo e entrega.
        set({ mode });
      },

      chooseCity: (cityId) => {
        set({ cityId });
      },

      setAddressField: (field, value) => {
        set((state) => ({ address: { ...state.address, [field]: value } }));
      },

      applySavedAddress: (address, cityId) => {
        // A cidade so e trocada quando o endereco salvo tem uma que a loja
        // ainda atende: quem resolve isso e quem chamou, comparando com a
        // lista de `/delivery-cities`. Vazio aqui significa "mantenha a que
        // estava", e nao "apague a escolha".
        set((state) => ({ address, cityId: cityId === '' ? state.cityId : cityId }));
      },

      chooseMethod: (method) => {
        // O PIX nao parcela. Voltar o contador a 1 evita que o "6x" escolhido
        // no cartao continue no corpo da cotacao depois da troca — o servidor
        // ignoraria, mas a tela leria o proprio estado e escreveria "6x" no
        // resumo de um pagamento a vista.
        set(method === PAYMENT_METHODS.PIX ? { method, installments: 1 } : { method });
      },

      chooseInstallments: (installments) => {
        set({ installments });
      },

      setContactField: (field, value) => {
        set((state) => ({ contact: { ...state.contact, [field]: value } }));
      },

      reset: () => {
        set(INITIAL);
      },
    }),
    {
      name: 'maison-essence.checkout',
      storage: createJSONStorage(() => localStorage),
      version: 1,

      /**
       * Os campos escritos um a um, como na sacola.
       *
       * Nao e `...state` com omissoes: a lista curta e o que obriga quem
       * acrescentar um campo a escreve-lo aqui e a responder por que ele
       * precisa sobreviver ao fechamento do navegador. E o lugar onde um
       * `totalCents` tentaria entrar.
       */
      partialize: (state) => ({
        step: state.step,
        mode: state.mode,
        cityId: state.cityId,
        address: state.address,
        method: state.method,
        installments: state.installments,
        contact: state.contact,
      }),
    },
  ),
);

/* ---- Os seletores --------------------------------------------------------
 *
 * Funcoes soltas, como na sacola: `useCheckout(checkoutStep)` re-renderiza a
 * trilha quando a etapa muda, e nao a cada tecla digitada no endereco.
 */

export function checkoutStep(state: CheckoutState): CheckoutStep {
  return state.step;
}

/** O endereco sera pedido: so na entrega. */
export function needsAddress(state: CheckoutState): boolean {
  return state.mode === 'DELIVERY';
}
