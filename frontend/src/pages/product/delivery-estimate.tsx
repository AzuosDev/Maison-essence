import { useId } from 'react';
import { Select } from '@/components/ui';
import { useChosenCity, useDeliveryCities } from '@/features/delivery';
import { useStoreSettings } from '@/features/settings';
import { addressLines } from '@/lib/format';
import styles from './delivery-estimate.module.css';

/**
 * Quanto custa e quando chega — antes do checkout.
 *
 * Esta loja entrega num punhado de cidades do Cariri, com taxa fixa por
 * cidade cadastrada no painel. Nao ha calculo por CEP, e essa simplicidade e
 * uma vantagem: da para responder "quanto e o frete?" aqui, com um seletor,
 * em vez de mandar o cliente preencher um endereco para descobrir.
 *
 * A pergunta e a que mais chega pelo WhatsApp antes da compra. Respondida na
 * pagina do produto, ela deixa de ser uma conversa.
 *
 * ## A cidade fica lembrada
 *
 * No `localStorage`, por `useChosenCity`. Quem mora em Juazeiro informa isso
 * uma vez, e nao a cada produto que abre — e o checkout vai encontrar a
 * mesma escolha ja feita.
 *
 * ## A retirada
 *
 * Aparece quando a dona liga a retirada e cadastra o endereco. E uma opcao
 * de verdade para quem mora perto: sem taxa e sem prazo, com o endereco
 * escrito por extenso para caber no aplicativo de mapa.
 */
export function DeliveryEstimate() {
  const fieldId = useId();
  const titleId = useId();

  const { settings } = useStoreSettings();
  const { data: cities, isPending, isError } = useDeliveryCities();
  const [cityId, chooseCity] = useChosenCity();

  const options = cities ?? [];
  const chosen = options.find((city) => city.id === cityId) ?? null;
  const pickup = settings?.pickupEnabled === true ? settings.pickupAddress : null;

  // Sem cidade cadastrada e sem retirada nao ha o que dizer, e uma caixa
  // vazia com o titulo "Entrega" so ocuparia espaco entre o preco e as abas.
  if (!isPending && options.length === 0 && pickup === null) {
    return null;
  }

  return (
    <section className={styles.block} aria-labelledby={titleId}>
      <h2 className={styles.title} id={titleId}>
        Entrega e retirada
      </h2>

      {isError ? (
        <p className={styles.note}>
          Não foi possível carregar as taxas agora. Pergunte pelo WhatsApp que a gente responde na
          hora.
        </p>
      ) : (
        <div className={styles.delivery}>
          <Select
            id={fieldId}
            label="Receber em"
            placeholder={isPending ? 'Carregando as cidades...' : 'Escolha a sua cidade'}
            value={chosen?.id ?? ''}
            disabled={isPending}
            options={options.map((city) => ({
              value: city.id,
              label: `${city.name}/${city.state}`,
            }))}
            onChange={(event) => {
              chooseCity(event.target.value);
            }}
          />

          {/* `aria-live` porque a resposta aparece sem que a pagina mude:
              quem nao ve a tela precisa ouvir a taxa que acabou de chegar. */}
          <div className={styles.result} aria-live="polite">
            {chosen === null ? (
              <p className={styles.note}>Escolha a cidade para ver a taxa e o prazo.</p>
            ) : (
              <>
                <p className={styles.line}>
                  <span className={styles.label}>Taxa</span>
                  <strong className="tabular">{chosen.feeLabel}</strong>
                </p>

                <p className={styles.line}>
                  <span className={styles.label}>Prazo</span>
                  <strong>{chosen.estimatedLabel}</strong>
                </p>

                {chosen.freeFromLabel === '' ? null : (
                  <p className={styles.free}>{chosen.freeFromLabel}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {pickup === null ? null : (
        <div className={styles.pickup}>
          <p className={styles.line}>
            <span className={styles.label}>Retirar na loja</span>
            <strong>Grátis</strong>
          </p>

          <address className={styles.address}>
            {addressLines(pickup).map((line) => (
              <span key={line}>{line}</span>
            ))}

            {pickup.reference === '' ? null : (
              <span className={styles.reference}>{pickup.reference}</span>
            )}
          </address>

          {settings?.pickupInstructions === undefined || settings.pickupInstructions === '' ? null : (
            <p className={styles.note}>{settings.pickupInstructions}</p>
          )}
        </div>
      )}
    </section>
  );
}
