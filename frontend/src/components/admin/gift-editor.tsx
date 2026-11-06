import { Input } from '@/components/ui';
import { SETTINGS_LIMITS, useProduct, type GiftDraft, type GiftErrors } from '@/features/admin';
import { imageUrl } from '@/lib/cloudinary';
import { centsFromInput, formatCents } from '@/lib/format';
import { ProductPicker } from './product-picker';
import styles from './gift-editor.module.css';

/**
 * O brinde por valor de compra: "Compre R$ 179,99 e ganhe um porta
 * hidratante".
 *
 * ## Três campos e uma frase
 *
 * O valor meta, o produto e a frase não são três configurações — são uma
 * sentenca, e e por isso que a prévia fica no fim do bloco. "17999" e "porta
 * hidratante" separados não dizem o que a cliente vai ler; "Compre R$ 179,99
 * e ganhe um porta hidratante com a melhor pasta árabe dentro" diz, e e essa
 * leitura que a dona vem conferir aqui.
 *
 * ## A prévia também diz quando não vai aparecer
 *
 * Esta e a configuração mais fácil de deixar pela metade na loja inteira:
 * ligar o brinde, salvar e não ver nada acontecer. O servidor aceita, nenhum
 * erro aparece, e o que falta — o valor, o nome — só se descobre abrindo o
 * site. A prévia responde isso antes de salvar, com as mesmas palavras da
 * regra que decide lá (ver `gift.ts`, no backend).
 *
 * ## A frase vence o nome do produto
 *
 * Escrita, ela e o que a loja mostra; em branco, vale o nome do produto. E
 * assim porque "um porta hidratante com a melhor pasta árabe dentro" vende o
 * que "Porta Hidratante ME" não vende — e porque o cadastro do produto serve
 * a vitrine, não a campanha.
 */
export interface GiftEditorProps {
  gift: GiftDraft;
  errors?: GiftErrors | undefined;
  onChange: (gift: GiftDraft) => void;
}

export function GiftEditor({ gift, errors, onChange }: GiftEditorProps) {
  // Mesma consulta que o seletor abaixo faz: o React Query a serve uma vez
  // só, e e dela que saem a foto e o nome da prévia.
  const chosen = useProduct(gift.productId ?? '');

  const set = (patch: Partial<GiftDraft>): void => {
    onChange({ ...gift, ...patch });
  };

  return (
    <div className={styles.editor}>
      <div className={styles.pair}>
        <Input
          label="A partir de"
          block
          numeric
          inputMode="decimal"
          prefix="R$"
          placeholder="179,99"
          hint="O valor dos produtos na sacola, sem o frete."
          value={gift.minValue}
          error={errors?.minValue}
          onChange={(event) => {
            set({ minValue: event.target.value });
          }}
        />

        <Input
          label="A frase do brinde"
          block
          maxLength={SETTINGS_LIMITS.giftLabel}
          placeholder="um porta hidratante com a melhor pasta árabe dentro"
          hint="Completa “Compre R$ 179,99 e ganhe…”. Em branco, vale o nome do produto."
          value={gift.label}
          error={errors?.label}
          onChange={(event) => {
            set({ label: event.target.value });
          }}
        />
      </div>

      <ProductPicker
        productId={gift.productId}
        onChange={(productId) => {
          set({ productId });
        }}
        copy={{
          unset: 'Sem produto escolhido: o aviso do brinde aparece só com a frase, sem foto.',
          gone: 'O produto escolhido não esta mais no cadastro. Escolha outro, ou siga só com a frase.',
          clear: 'Tirar o produto',
          searchLabel: 'O produto que a cliente ganha',
          searchHint: 'Vale qualquer produto do cadastro, publicado ou não — brinde não se vende.',
          current: 'e o brinde',
        }}
      />

      <Preview
        gift={gift}
        name={chosen.data?.name ?? ''}
        image={chosen.data?.coverImage ?? ''}
      />
    </div>
  );
}

/**
 * O balão como a cliente vai lê-lo.
 *
 * Não e o componente da loja — a vitrine e o painel não compartilham
 * componente —, e sim a mesma frase montada pela mesma regra. O que se
 * confere aqui e o texto, que e o que a dona escreveu.
 */
function Preview({ gift, name, image }: { gift: GiftDraft; name: string; image: string }) {
  const cents = centsFromInput(gift.minValue);
  const label = gift.label.trim() === '' ? name : gift.label.trim();
  const live = gift.isActive && cents !== null && cents > 0 && label !== '';

  if (!live) {
    return (
      <p className={styles.off}>
        Do jeito que esta, o aviso do brinde não aparece na loja.{' '}
        {gift.isActive
          ? 'Falta dizer a partir de quanto ele vale e o que a cliente ganha.'
          : 'O brinde esta desligado.'}
      </p>
    );
  }

  return (
    <figure className={styles.preview}>
      <figcaption className={styles.caption}>Na loja, a cliente lê:</figcaption>

      <div className={styles.balloon}>
        {image === '' ? (
          <span className={styles.blank} aria-hidden="true" />
        ) : (
          <img
            // A menor largura, sem `srcSet`: numa prévia de 48px as outras
            // duas seriam banda gasta a toa.
            src={imageUrl(image, 'thumb')}
            alt=""
            width="48"
            height="48"
            className={styles.photo}
          />
        )}

        <p className={styles.text}>
          Compre <strong className={styles.amount}>{formatCents(cents)}</strong> e ganhe {label}
        </p>
      </div>
    </figure>
  );
}
