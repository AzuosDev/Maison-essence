import { useState } from 'react';
import { Button, Modal, Radio, RadioGroup } from '@/components/ui';
import { displayVariant, type PublicProduct } from '@/features/catalog';
import { imageUrl } from '@/lib/cloudinary';
import { formatCents } from '@/lib/format';
import { useAddToCart } from './use-add-to-cart';
import styles from './variant-picker.module.css';

/**
 * A escolha da variante, sem sair da vitrine.
 *
 * O card so abre este modal quando ha mais de uma opcao — com uma so, ele
 * adiciona direto, porque escolher entre uma coisa e um clique cobrado por
 * nada. Ver `soleVariant` em `features/catalog/product-display.ts`.
 *
 * Variante esgotada aparece na lista, desabilitada, em vez de ser omitida.
 * Some-la faria o cliente que procura os 100ml achar que o produto nunca teve
 * esse tamanho; mostrando-a esgotada, ele entende que e questao de voltar
 * depois — e pode levar outro tamanho agora.
 */
interface VariantPickerProps {
  product: PublicProduct;
  open: boolean;
  onClose: () => void;
}

export function VariantPicker({ product, open, onClose }: VariantPickerProps) {
  const addToCart = useAddToCart();
  // A opcao mais barata **entre as disponiveis** ja vem marcada: abrir o
  // seletor com uma variante esgotada em foco deixaria o botao desabilitado
  // sem o cliente ter feito nada.
  //
  // Inicializada no primeiro render, e nao reposta por efeito: o card so
  // monta este componente depois do clique e o desmonta ao fechar, entao
  // cada abertura e um componente novo, com a escolha ja no lugar.
  const [selectedId, setSelectedId] = useState(() => firstAvailableId(product));

  const selected = product.variants.find((variant) => variant.id === selectedId) ?? null;
  const cover = displayVariant(product);

  const add = () => {
    if (selected === null) {
      return;
    }

    addToCart(product, selected);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Escolha a opcao"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>

          <Button onClick={add} disabled={selected === null || !selected.isAvailable}>
            Adicionar a sacola
          </Button>
        </>
      }
    >
      <div className={styles.summary}>
        <img
          className={styles.thumb}
          src={imageUrl(cover?.image === '' ? product.coverImage : cover?.image, 'thumb')}
          alt=""
          width={144}
          height={192}
          loading="lazy"
          decoding="async"
        />

        <div>
          {product.brand === '' ? null : <p className={styles.brand}>{product.brand}</p>}
          <p className={styles.name}>{product.name}</p>
        </div>
      </div>

      <RadioGroup
        legend="Opcoes disponiveis"
        name={`variant-${product.id}`}
        value={selectedId}
        onChange={setSelectedId}
        className={styles.options}
      >
        {product.variants.map((variant) => (
          <Radio
            key={variant.id}
            value={variant.id}
            label={variant.label === '' ? product.name : variant.label}
            disabled={!variant.isAvailable}
            description={
              <>
                <span className={`${styles.optionPrice} tabular`}>
                  {formatCents(variant.priceCents)}
                </span>

                {variant.isAvailable ? null : (
                  <span className={styles.unavailable}> · Esgotado</span>
                )}
              </>
            }
          />
        ))}
      </RadioGroup>
    </Modal>
  );
}

/** A mais barata entre as disponiveis; vazio quando nao ha nenhuma. */
function firstAvailableId(product: PublicProduct): string {
  const available = product.variants.filter((variant) => variant.isAvailable);

  const cheapest = available.reduce<(typeof available)[number] | null>(
    (best, variant) => (best === null || variant.priceCents < best.priceCents ? variant : best),
    null,
  );

  return cheapest?.id ?? '';
}
