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
 * Existe por um critério de aceite — "recarregar no meio do checkout não
 * perde nada" — e esse critério não e capricho. O checkout e a tela onde o
 * cliente sai para conferir o CEP no aplicativo dos Correios, atende o
 * telefone, troca de aba e volta; no celular, trocar de aplicativo e o
 * suficiente para o navegador descartar a página. Um estado só em memória
 * faria cada uma dessas idas apagar o endereço inteiro, e a pessoa recomeca
 * — ou desiste, que e o que costuma acontecer no quarto campo.
 *
 * ## O que atravessa o armazenamento
 *
 * Tudo o que o cliente **escolheu ou digitou**: a etapa em que parou, o modo
 * de entrega, a cidade, o endereço, a forma de pagamento, o parcelamento, o
 * nome e o WhatsApp.
 *
 * E nada mais. Não há total, não há taxa de entrega, não há valor de
 * parcela. A razão e a mesma que mantem preço fora da sacola: um total
 * gravado aqui sobrevive ao reajuste, a promoção que acabou e a taxa que a
 * dona mudou ontem, e volta intacto na tela de quem deixou a aba aberta
 * durante a noite — que leria um número e pagaria outro. Todo valor em reais
 * desta tela vem de `POST /cart/quote`, refeito a cada mudanca de qualquer
 * campo daqui.
 *
 * ## Por que os campos ficam aqui, e não num formulário
 *
 * O resto da loja valida com `react-hook-form`, e este não. A diferença e a
 * persistência: o formulário mantem o próprio estado interno, e sincroniza-lo
 * com o armazenamento a cada tecla exigiria um efeito em cima do `watch` —
 * com a janela entre digitar e sincronizar sendo exatamente o instante em
 * que o celular descarta a aba. Com os campos no store, o que esta na tela e
 * o que esta guardado, sem intermediário. A validação continua sendo Zod,
 * em `checkout.schema.ts`, rodada na hora de avançar.
 */

interface CheckoutState {
  /** Em qual das quatro etapas o cliente parou. */
  step: CheckoutStep;

  /** `null` até ele escolher. Não há modo padrão: escolher e a etapa 2. */
  mode: FulfillmentMode | null;

  /** O id da cidade atendida. Vazio na retirada e antes da escolha. */
  cityId: string;

  /**
   * O endereço, que sobrevive a troca de modo.
   *
   * Quem digitou o endereço, experimentou a retirada e voltou para a entrega
   * encontra o que escreveu. Na retirada ele simplesmente não e exigido nem
   * enviado — ver `fulfillmentSchema`.
   */
  address: CheckoutAddress;

  method: PaymentMethod | null;

  /** Sempre 1 no PIX, que não parcela. */
  installments: number;

  contact: CheckoutContact;

  goTo: (step: CheckoutStep) => void;
  advance: () => void;
  goBack: () => void;

  chooseMode: (mode: FulfillmentMode) => void;
  chooseCity: (cityId: string) => void;
  /** Um campo do endereço por vez, como o `onChange` do campo entrega. */
  setAddressField: (field: keyof CheckoutAddress, value: string) => void;
  /** O endereço salvo da conta, aplicado de uma vez. */
  applySavedAddress: (address: CheckoutAddress, cityId: string) => void;

  chooseMethod: (method: PaymentMethod) => void;
  chooseInstallments: (installments: number) => void;

  setContactField: (field: keyof CheckoutContact, value: string) => void;

  /** Pedido fechado: o checkout volta ao início, sem rastro do anterior. */
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
        // A cidade não e apagada ao trocar para a retirada: quem volta para a
        // entrega encontra a que já tinha escolhido. Quem manda na taxa e o
        // modo, e a cotação só recebe a cidade quando o modo e entrega.
        set({ mode });
      },

      chooseCity: (cityId) => {
        set({ cityId });
      },

      setAddressField: (field, value) => {
        set((state) => ({ address: { ...state.address, [field]: value } }));
      },

      applySavedAddress: (address, cityId) => {
        // A cidade só e trocada quando o endereço salvo tem uma que a loja
        // ainda atende: quem resolve isso e quem chamou, comparando com a
        // lista de `/delivery-cities`. Vazio aqui significa "mantenha a que
        // estava", e não "apague a escolha".
        set((state) => ({ address, cityId: cityId === '' ? state.cityId : cityId }));
      },

      chooseMethod: (method) => {
        // O PIX não parcela. Voltar o contador a 1 evita que o "6x" escolhido
        // no cartão continue no corpo da cotação depois da troca — o servidor
        // ignoraria, mas a tela leria o próprio estado e escreveria "6x" no
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
       * Não e `...state` com omissões: a lista curta e o que obriga quem
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
 * Funções soltas, como na sacola: `useCheckout(checkoutStep)` re-renderiza a
 * trilha quando a etapa muda, e não a cada tecla digitada no endereço.
 */

export function checkoutStep(state: CheckoutState): CheckoutStep {
  return state.step;
}

/** O endereço será pedido: só na entrega. */
export function needsAddress(state: CheckoutState): boolean {
  return state.mode === 'delivery';
}
