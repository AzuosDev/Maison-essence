import { useEffect, useMemo, useState } from 'react';
import { Input, Radio, RadioGroup, Select } from '@/components/ui';
import { useCustomerSession, type CustomerAddress } from '@/features/auth';
import {
  FULFILLMENT_MODES,
  NO_ERRORS,
  fieldErrors,
  fulfillmentSchema,
  useCheckout,
  type CheckoutAddress,
  type CheckoutQuoteView,
} from '@/features/checkout';
import { useChosenCity, useDeliveryCities, type PublicDeliveryCity } from '@/features/delivery';
import { useStoreSettings } from '@/features/settings';
import { cx } from '@/lib/cx';
import { addressLines, formatCents } from '@/lib/format';
import { StepCard } from './step-card';
import { StepTotal } from './step-total';
import styles from './step-fulfillment.module.css';

/**
 * Etapa 2: receber em casa ou retirar na loja.
 *
 * A etapa inteira gira em torno de uma escolha, e o desenho segue isso: dois
 * cartoes grandes, um do lado do outro, cada um com o que a escolha implica
 * escrito nele. Nao sao dois radios pequenos numa lista — a decisao muda o
 * resto do formulario e muda o total, e um alvo de toque de 20px nao e o
 * tamanho de uma decisao dessas no celular.
 *
 * ## Retirada nao pede endereco. Nenhum.
 *
 * E o criterio de aceite, e vale nas tres camadas: os campos somem da tela,
 * `fulfillmentSchema` para de exigi-los e o corpo de `POST /orders` sai sem
 * o objeto de endereco. Pedir bairro para quem vai buscar na loja e o tipo
 * de campo que faz a pessoa fechar a aba.
 *
 * O que aparece no lugar e o que ela precisa: o endereco **da loja**, o
 * horario e as instrucoes que a dona escreveu no painel.
 *
 * ## A taxa, logo abaixo da cidade
 *
 * Quem escolhe a cidade quer saber quanto custa, e quer saber agora. O valor
 * aparece na linha seguinte ao seletor, no mesmo instante — vindo da lista
 * de `/delivery-cities`, que ja traz o rotulo pronto — e e confirmado pela
 * cotacao que sai no mesmo clique. Os dois numeros vem do mesmo servidor;
 * nenhum deles e calculado aqui.
 *
 * ## O endereco que a conta ja tem
 *
 * Cliente logado com endereco salvo escolhe com um toque. E o unico ganho
 * real de ter conta nesta loja, e ele acontece justamente no passo que mais
 * cansa. Sem conta, nada muda: o formulario simplesmente pergunta.
 */

export interface StepFulfillmentProps {
  quoting: CheckoutQuoteView;
  focusOnMount: boolean;
  onContinue: () => void;
  onBack: () => void;
}

export function StepFulfillment({
  quoting,
  focusOnMount,
  onContinue,
  onBack,
}: StepFulfillmentProps) {
  const mode = useCheckout((state) => state.mode);
  const cityId = useCheckout((state) => state.cityId);
  const address = useCheckout((state) => state.address);
  const chooseMode = useCheckout((state) => state.chooseMode);
  const chooseCity = useCheckout((state) => state.chooseCity);
  const setAddressField = useCheckout((state) => state.setAddressField);
  const applySavedAddress = useCheckout((state) => state.applySavedAddress);

  const { settings } = useStoreSettings();
  const { data: cities, isPending: citiesPending } = useDeliveryCities();
  const [rememberedCity, rememberCity] = useChosenCity();

  /**
   * Os erros aparecem depois da primeira tentativa, e somem sozinhos.
   *
   * Validar a cada tecla marcaria de vermelho o campo de quem ainda esta
   * digitando a primeira letra da rua. Validar so no clique deixaria o erro
   * na tela enquanto a pessoa corrige o campo ao lado. O meio-termo e
   * classico e e este: silencio ate a primeira tentativa, revalidacao viva
   * dali em diante — que sai de graca por o resultado ser recalculado no
   * render, sem efeito nenhum sincronizando estado de erro.
   */
  const [tried, setTried] = useState(false);
  const result = fulfillmentSchema.safeParse({ mode, cityId, address });
  const errors = tried && !result.success ? fieldErrors(result.error) : NO_ERRORS;

  const pickupEnabled = settings?.pickupEnabled === true;
  const isDelivery = mode === FULFILLMENT_MODES.DELIVERY;

  /**
   * A cidade que este navegador ja escolheu na pagina do produto.
   *
   * Preenchida uma vez, e so quando a loja ainda atende aquela cidade: uma
   * cidade removida do painel simplesmente nao casa, e o seletor abre como
   * abre para quem nunca escolheu. Depois que ha escolha no checkout, o
   * efeito nao tem mais o que fazer.
   */
  useEffect(() => {
    if (cityId === '' && rememberedCity !== '' && cities?.some((c) => c.id === rememberedCity)) {
      chooseCity(rememberedCity);
    }
  }, [cityId, rememberedCity, cities, chooseCity]);

  const selectedCity = cities?.find((city) => city.id === cityId) ?? null;

  const savedAddresses = useSavedAddressOptions(cities);

  const submit = (): void => {
    setTried(true);

    if (result.success) {
      onContinue();
    }
  };

  return (
    <StepCard
      title="Entrega ou retirada"
      description="Escolha como quer receber. A taxa aparece na hora, calculada pela loja."
      focusOnMount={focusOnMount}
      actionLabel="Continuar"
      onAction={submit}
      onBack={onBack}
      total={<StepTotal quoting={quoting} />}
    >
      <RadioGroup
        legend="Como você quer receber"
        name="fulfillment-mode"
        value={mode ?? ''}
        onChange={(value) => {
          chooseMode(value === FULFILLMENT_MODES.PICKUP
            ? FULFILLMENT_MODES.PICKUP
            : FULFILLMENT_MODES.DELIVERY);
        }}
        error={errors.mode}
        horizontal
        className={styles.modes}
      >
        <Radio
          value={FULFILLMENT_MODES.DELIVERY}
          label="Receber em casa"
          description="Entrega nas cidades atendidas, com taxa por cidade."
          card
          className={styles.choice}
        />

        {/* A retirada so aparece quando a loja a oferece. Escondida, e um
            caminho a menos; desabilitada, seria uma pergunta sem resposta. */}
        {pickupEnabled ? (
          <Radio
            value={FULFILLMENT_MODES.PICKUP}
            label="Retirar na loja"
            description="Sem taxa. Você busca no endereço abaixo."
            card
            className={styles.choice}
          />
        ) : null}
      </RadioGroup>

      {mode === FULFILLMENT_MODES.PICKUP ? <PickupPanel /> : null}

      {isDelivery ? (
        <div className={styles.delivery}>
          <Select
            label="Cidade da entrega"
            placeholder={citiesPending ? 'Carregando as cidades...' : 'Escolha a sua cidade'}
            value={cityId}
            options={(cities ?? []).map((city) => ({
              value: city.id,
              label: `${city.name} — ${city.state}`,
            }))}
            error={errors.cityId}
            onChange={(event) => {
              chooseCity(event.target.value);
              rememberCity(event.target.value);
            }}
          />

          <DeliveryFee city={selectedCity} quoting={quoting} />

          {savedAddresses.length > 0 ? (
            <SavedAddresses
              addresses={savedAddresses}
              onPick={(saved) => {
                applySavedAddress(saved.address, saved.cityId);

                if (saved.cityId !== '') {
                  rememberCity(saved.cityId);
                }
              }}
            />
          ) : null}

          <div className={styles.fields}>
            <Input
              label="Rua"
              value={address.street}
              autoComplete="address-line1"
              error={errors['address.street']}
              className={styles.wide}
              onChange={(event) => { setAddressField('street', event.target.value); }}
            />

            <Input
              label="Número"
              value={address.number}
              autoComplete="address-line2"
              placeholder="s/n"
              error={errors['address.number']}
              onChange={(event) => { setAddressField('number', event.target.value); }}
            />

            <Input
              label="Complemento"
              value={address.complement}
              hint="Apartamento, bloco, casa dos fundos."
              error={errors['address.complement']}
              onChange={(event) => { setAddressField('complement', event.target.value); }}
            />

            <Input
              label="Bairro"
              value={address.district}
              autoComplete="address-level3"
              className={styles.wide}
              error={errors['address.district']}
              onChange={(event) => { setAddressField('district', event.target.value); }}
            />

            <Input
              label="Ponto de referência"
              value={address.reference}
              hint="Perto de que? E o que mais ajuda a achar a sua casa."
              error={errors['address.reference']}
              className={styles.wide}
              onChange={(event) => { setAddressField('reference', event.target.value); }}
            />
          </div>

          {/* Nao ha campo de CEP, e a ausencia merece uma linha: sem ela, o
              cliente procura o campo que sempre existiu nos outros sites e
              conclui que o formulario esta quebrado. */}
          <p className={styles.noZip}>
            Não pedimos CEP: a taxa vem da cidade escolhida, e não da faixa de endereço.
          </p>
        </div>
      ) : null}
    </StepCard>
  );
}

/* ---- A retirada ----------------------------------------------------------- */

/**
 * Onde buscar, a que horas e o que levar.
 *
 * Tudo sai do painel. Sem endereco cadastrado, o bloco diz a verdade — a
 * loja combina o ponto pelo WhatsApp — em vez de desenhar uma moldura vazia
 * com tres linhas em branco.
 */
function PickupPanel() {
  const { settings } = useStoreSettings();
  const pickupAddress = settings?.pickupAddress ?? null;
  const lines = pickupAddress === null ? [] : addressLines(pickupAddress);

  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>Retirada na loja</h3>

      {lines.length === 0 ? (
        <p className={styles.panelText}>
          O ponto de retirada e combinado pelo WhatsApp junto com o pagamento.
        </p>
      ) : (
        <address className={styles.address}>
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </address>
      )}

      {settings?.businessHours ? (
        <p className={styles.panelRow}>
          <span className={styles.panelLabel}>Horário</span>
          {settings.businessHours}
        </p>
      ) : null}

      {settings?.pickupInstructions ? (
        <p className={styles.panelRow}>
          <span className={styles.panelLabel}>Como funciona</span>
          {settings.pickupInstructions}
        </p>
      ) : null}

      <p className={styles.panelNote}>Sem taxa de entrega.</p>
    </div>
  );
}

/* ---- A taxa --------------------------------------------------------------- */

/**
 * Quanto custa entregar nesta cidade.
 *
 * Duas fontes, o mesmo servidor. A cotacao e a que vale — e ela que conhece
 * o subtotal e sabe se o frete gratis foi atingido —, mas ela leva uma ida
 * de rede para responder. Enquanto isso, o rotulo que veio com a lista de
 * cidades ja esta em maos e diz a taxa cheia daquela cidade.
 *
 * Mostrar o rotulo primeiro e trocar pelo da cotacao e o que faz o valor
 * aparecer **no mesmo clique** da escolha, sem numero nenhum calculado aqui:
 * os dois textos foram escritos pela API.
 */
function DeliveryFee({
  city,
  quoting,
}: {
  city: PublicDeliveryCity | null;
  quoting: CheckoutQuoteView;
}) {
  if (city === null) {
    return null;
  }

  const { quote, isFetching } = quoting;

  // A cotacao so responde por esta cidade quando foi ela que a pediu. Entre
  // o clique e a resposta, a cotacao em maos ainda e a da cidade anterior.
  const quoted =
    quote !== undefined &&
    quote.fulfillment.mode === FULFILLMENT_MODES.DELIVERY &&
    quote.fulfillment.cityId === city.id
      ? quote
      : null;

  const free = quoted?.fulfillment.isFree ?? city.feeCents === 0;

  return (
    <div className={cx(styles.fee, isFetching && styles.feeUpdating)} aria-busy={isFetching}>
      <p className={styles.feeRow}>
        <span>Taxa de entrega</span>

        <strong className={cx(styles.feeValue, free && styles.feeFree, 'tabular')}>
          {free ? 'Grátis' : formatCents(quoted?.deliveryFeeCents ?? city.feeCents)}
        </strong>
      </p>

      <p className={styles.feeNote}>
        {city.estimatedLabel}
        {free && quoted?.fulfillment.freeReason ? ` · ${quoted.fulfillment.freeReason}` : ''}
        {!free && city.freeFromLabel !== '' ? ` · ${city.freeFromLabel}` : ''}
      </p>
    </div>
  );
}

/* ---- Os enderecos da conta ------------------------------------------------ */

interface SavedAddressOption {
  id: string;
  label: string;
  line: string;
  address: CheckoutAddress;
  /** Vazio quando a cidade do endereco salvo nao e mais atendida. */
  cityId: string;
}

/**
 * Os enderecos da conta, prontos para um clique.
 *
 * A cidade so acompanha quando a loja ainda a atende: um endereco salvo
 * quando ela entregava em Barbalha nao pode selecionar uma cidade que sumiu
 * da lista. Nesse caso o endereco entra e a cidade continua a escolher — que
 * e melhor que nao oferecer o endereco de jeito nenhum.
 */
function useSavedAddressOptions(
  cities: readonly PublicDeliveryCity[] | undefined,
): SavedAddressOption[] {
  const customer = useCustomerSession((state) => state.user);

  return useMemo(() => {
    if (customer === null) {
      return [];
    }

    return customer.addresses.map((saved) => ({
      id: saved.id,
      label: saved.label === '' ? 'Endereço salvo' : saved.label,
      line: savedAddressLine(saved),
      address: {
        street: saved.street,
        number: saved.number,
        complement: saved.complement,
        district: saved.district,
        reference: saved.reference,
      },
      cityId: hasCity(cities, saved.cityId) ? (saved.cityId ?? '') : '',
    }));
  }, [customer, cities]);
}

/**
 * A loja ainda atende a cidade deste endereco salvo.
 *
 * `null` nao casa com nada, e endereco salvo sem cidade vinculada existe: e
 * o de quem se cadastrou antes de a loja usar a lista de cidades.
 */
function hasCity(
  cities: readonly PublicDeliveryCity[] | undefined,
  cityId: string | null,
): boolean {
  return cityId !== null && (cities?.some((city) => city.id === cityId) ?? false);
}

function savedAddressLine(saved: CustomerAddress): string {
  return [saved.street, saved.number, saved.district].filter((part) => part !== '').join(', ');
}

function SavedAddresses({
  addresses,
  onPick,
}: {
  addresses: readonly SavedAddressOption[];
  onPick: (address: SavedAddressOption) => void;
}) {
  return (
    <div className={styles.saved}>
      <p className={styles.savedTitle}>Usar um endereço salvo</p>

      <ul className={styles.savedList}>
        {addresses.map((saved) => (
          <li key={saved.id}>
            <button
              type="button"
              className={styles.savedItem}
              onClick={() => {
                onPick(saved);
              }}
            >
              <span className={styles.savedLabel}>{saved.label}</span>
              <span className={styles.savedLine}>{saved.line}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

