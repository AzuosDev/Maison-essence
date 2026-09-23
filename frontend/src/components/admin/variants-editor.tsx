import { Button, Input, Select, Switch } from '@/components/ui';
import {
  PRODUCT_LIMITS,
  duplicateVariant,
  newVariant,
  type DraftErrors,
  type VariantDraft,
} from '@/features/admin';
import { imageUrl } from '@/lib/cloudinary';
import { useMediaQuery } from '@/lib/use-media-query';
import { CopyIcon, PlusIcon, TrashIcon } from './admin-icons';
import styles from './variants-editor.module.css';

/**
 * As variantes do produto.
 *
 * ## Por que um produto sempre tem pelo menos uma
 *
 * No dominio nao existe produto sem variante: o preco, o SKU e o estoque
 * moram nela, e nao no produto. O "produto simples" — um frasco so — e uma
 * variante unica com o nome em branco, e a tela diz isso em vez de esconder
 * a secao: quem cadastra precisa saber onde o preco esta guardado para
 * saber onde muda-lo depois.
 *
 * ## Duplicar e o gesto principal
 *
 * Um perfume entra em 50 ml, 100 ml e 200 ml pelo mesmo preco por mililitro,
 * com o mesmo estoque inicial e a mesma foto. Preencher a segunda linha do
 * zero e refazer seis campos para trocar um. Duplicar copia o trabalho e
 * descarta a identidade — `id` e `sku` saem fora, porque sao unicos por
 * variante (ver `duplicateVariant`).
 *
 * ## A foto sai da galeria do produto
 *
 * Nao ha upload por variante. A variante escolhe **uma das fotos que o
 * produto ja tem**, e por isso o campo e um seletor e nao um botao de
 * enviar: manter duas galerias obrigaria a dona a decidir, a cada foto, em
 * qual das duas ela vai — e a resposta certa e sempre "nas duas".
 *
 * ## No celular cada variante e um bloco
 *
 * Nove campos numa linha de tabela nao cabem em 360px, e uma tabela com
 * rolagem horizontal num formulario faz perder o campo enquanto se digita. O
 * bloco empilhado mantem rotulo e campo juntos, que e o que um formulario
 * precisa.
 */

/** Acima disto, tabela. Abaixo, blocos. */
const WIDE = '(min-width: 64rem)';

export interface VariantsEditorProps {
  variants: readonly VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  /** As fotos do produto, para o seletor de imagem da variante. */
  images: readonly string[];
  errors: DraftErrors;
  /** Desligado para quem so pode ler. */
  disabled?: boolean;
}

export function VariantsEditor({
  variants,
  onChange,
  images,
  errors,
  disabled = false,
}: VariantsEditorProps) {
  const isWide = useMediaQuery(WIDE);

  const update = (key: string, patch: Partial<VariantDraft>): void => {
    onChange(variants.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)));
  };

  const duplicate = (key: string): void => {
    const next: VariantDraft[] = [];

    for (const variant of variants) {
      next.push(variant);

      if (variant.key === key) {
        // A copia entra logo abaixo da original, e nao no fim da lista: e ali
        // que o olho esta, e e ali que a diferenca entre as duas sera escrita.
        next.push(duplicateVariant(variant));
      }
    }

    onChange(next);
  };

  const remove = (key: string): void => {
    onChange(variants.filter((variant) => variant.key !== key));
  };

  const imageOptions = [
    { value: '', label: 'Usar a capa do produto' },
    ...images.map((publicId, index) => ({
      value: publicId,
      label: index === 0 ? 'Foto 1 (capa)' : `Foto ${String(index + 1)}`,
    })),
  ];

  const full = variants.length >= PRODUCT_LIMITS.variants;

  return (
    <div className={styles.editor}>
      {errors.variants === undefined ? null : (
        <p className={styles.listError} role="alert">
          {errors.variants}
        </p>
      )}

      {isWide ? (
        <VariantRows
          variants={variants}
          errors={errors}
          imageOptions={imageOptions}
          disabled={disabled}
          canRemove={variants.length > 1}
          onUpdate={update}
          onDuplicate={duplicate}
          onRemove={remove}
        />
      ) : (
        <VariantBlocks
          variants={variants}
          errors={errors}
          imageOptions={imageOptions}
          disabled={disabled}
          canRemove={variants.length > 1}
          onUpdate={update}
          onDuplicate={duplicate}
          onRemove={remove}
        />
      )}

      <Button
        type="button"
        variant="secondary"
        disabled={disabled || full}
        onClick={() => {
          onChange([...variants, newVariant()]);
        }}
      >
        <PlusIcon />
        Adicionar variante
      </Button>

      {full ? (
        <p className={styles.hint}>
          Sao no maximo {PRODUCT_LIMITS.variants} variantes por produto.
        </p>
      ) : null}
    </div>
  );
}

interface ListProps {
  variants: readonly VariantDraft[];
  errors: DraftErrors;
  imageOptions: { value: string; label: string }[];
  disabled: boolean;
  /** A ultima variante nao pode sair: produto sem variante nao existe. */
  canRemove: boolean;
  onUpdate: (key: string, patch: Partial<VariantDraft>) => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
}

/* ---- Desktop -------------------------------------------------------------- */

function VariantRows({
  variants,
  errors,
  imageOptions,
  disabled,
  canRemove,
  onUpdate,
  onDuplicate,
  onRemove,
}: ListProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Nome</th>
            <th scope="col">SKU</th>
            <th scope="col">Preco</th>
            <th scope="col">Preco de</th>
            <th scope="col">Estoque</th>
            <th scope="col">Foto</th>
            <th scope="col">Disponibilidade</th>
            <th scope="col">
              <span className="visually-hidden">Acoes</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {variants.map((variant, index) => {
            const line = errors.variant[variant.key] ?? {};

            return (
              <tr key={variant.key}>
                <td>
                  <Input
                    label={`Nome da variante ${String(index + 1)}`}
                    hideLabel
                    block
                    placeholder="100 ml"
                    maxLength={PRODUCT_LIMITS.variantLabel}
                    value={variant.label}
                    error={line.label}
                    disabled={disabled}
                    onChange={(event) => {
                      onUpdate(variant.key, { label: event.target.value });
                    }}
                  />
                </td>

                <td>
                  <Input
                    label={`SKU da variante ${String(index + 1)}`}
                    hideLabel
                    block
                    placeholder="gerado"
                    maxLength={PRODUCT_LIMITS.sku}
                    value={variant.sku}
                    error={line.sku}
                    disabled={disabled}
                    onChange={(event) => {
                      onUpdate(variant.key, { sku: event.target.value });
                    }}
                  />
                </td>

                <td className={styles.priceCell}>
                  <Input
                    label={`Preco da variante ${String(index + 1)}`}
                    hideLabel
                    block
                    numeric
                    inputMode="decimal"
                    prefix="R$"
                    placeholder="0,00"
                    value={variant.price}
                    error={line.price}
                    disabled={disabled}
                    onChange={(event) => {
                      onUpdate(variant.key, { price: event.target.value });
                    }}
                  />
                </td>

                <td className={styles.priceCell}>
                  <Input
                    label={`Preco de comparacao da variante ${String(index + 1)}`}
                    hideLabel
                    block
                    numeric
                    inputMode="decimal"
                    prefix="R$"
                    placeholder="sem"
                    value={variant.compareAtPrice}
                    disabled={disabled}
                    onChange={(event) => {
                      onUpdate(variant.key, { compareAtPrice: event.target.value });
                    }}
                  />
                </td>

                <td className={styles.stockCell}>
                  <Input
                    label={`Estoque da variante ${String(index + 1)}`}
                    hideLabel
                    block
                    numeric
                    inputMode="numeric"
                    value={variant.stock}
                    error={line.stock}
                    disabled={disabled}
                    onChange={(event) => {
                      onUpdate(variant.key, { stock: event.target.value });
                    }}
                  />
                </td>

                <td className={styles.imageCell}>
                  <VariantImage
                    variant={variant}
                    index={index}
                    options={imageOptions}
                    disabled={disabled}
                    onUpdate={onUpdate}
                  />
                </td>

                {/*
                  Os dois interruptores juntos, e nao em colunas separadas:
                  eles respondem a mesma pergunta — esta variante pode ser
                  comprada agora? — e uma nona coluna empurraria a tabela para
                  a rolagem horizontal, que num formulario faz perder o campo
                  enquanto se digita.
                */}
                <td className={styles.availability}>
                  <Switch
                    label="A venda"
                    checked={variant.isActive}
                    disabled={disabled}
                    className={styles.smallSwitch}
                    onChange={(event) => {
                      onUpdate(variant.key, { isActive: event.target.checked });
                    }}
                  />

                  <Switch
                    label="Sem estoque"
                    checked={variant.allowBackorder}
                    disabled={disabled}
                    className={styles.smallSwitch}
                    onChange={(event) => {
                      onUpdate(variant.key, { allowBackorder: event.target.checked });
                    }}
                  />
                </td>

                <td className={styles.rowActions}>
                  <RowButtons
                    index={index}
                    variantKey={variant.key}
                    disabled={disabled}
                    canRemove={canRemove}
                    onDuplicate={onDuplicate}
                    onRemove={onRemove}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---- Celular ---------------------------------------------------------------- */

function VariantBlocks({
  variants,
  errors,
  imageOptions,
  disabled,
  canRemove,
  onUpdate,
  onDuplicate,
  onRemove,
}: ListProps) {
  return (
    <ul className={styles.blocks}>
      {variants.map((variant, index) => {
        const line = errors.variant[variant.key] ?? {};

        return (
          <li key={variant.key} className={styles.block}>
            <div className={styles.blockHead}>
              <h3 className={styles.blockTitle}>
                {variant.label.trim() === ''
                  ? `Variante ${String(index + 1)}`
                  : variant.label.trim()}
              </h3>

              <RowButtons
                index={index}
                variantKey={variant.key}
                disabled={disabled}
                canRemove={canRemove}
                onDuplicate={onDuplicate}
                onRemove={onRemove}
              />
            </div>

            <Input
              label="Nome"
              block
              hint="Em branco quando o produto tem um frasco so."
              placeholder="100 ml"
              maxLength={PRODUCT_LIMITS.variantLabel}
              value={variant.label}
              error={line.label}
              disabled={disabled}
              onChange={(event) => {
                onUpdate(variant.key, { label: event.target.value });
              }}
            />

            <div className={styles.pair}>
              <Input
                label="Preco"
                block
                numeric
                inputMode="decimal"
                prefix="R$"
                placeholder="0,00"
                value={variant.price}
                error={line.price}
                disabled={disabled}
                onChange={(event) => {
                  onUpdate(variant.key, { price: event.target.value });
                }}
              />

              <Input
                label="Preco de"
                block
                numeric
                inputMode="decimal"
                prefix="R$"
                placeholder="sem"
                hint="O valor riscado no card."
                value={variant.compareAtPrice}
                disabled={disabled}
                onChange={(event) => {
                  onUpdate(variant.key, { compareAtPrice: event.target.value });
                }}
              />
            </div>

            <div className={styles.pair}>
              <Input
                label="Estoque"
                block
                numeric
                inputMode="numeric"
                value={variant.stock}
                error={line.stock}
                disabled={disabled}
                onChange={(event) => {
                  onUpdate(variant.key, { stock: event.target.value });
                }}
              />

              <Input
                label="SKU"
                block
                placeholder="gerado"
                hint="Em branco, o sistema gera."
                maxLength={PRODUCT_LIMITS.sku}
                value={variant.sku}
                error={line.sku}
                disabled={disabled}
                onChange={(event) => {
                  onUpdate(variant.key, { sku: event.target.value });
                }}
              />
            </div>

            <VariantImage
              variant={variant}
              index={index}
              options={imageOptions}
              disabled={disabled}
              onUpdate={onUpdate}
              showLabel
            />

            <div className={styles.switches}>
              <Switch
                label="A venda"
                checked={variant.isActive}
                disabled={disabled}
                onChange={(event) => {
                  onUpdate(variant.key, { isActive: event.target.checked });
                }}
              />

              <Switch
                label="Vender sem estoque"
                checked={variant.allowBackorder}
                disabled={disabled}
                onChange={(event) => {
                  onUpdate(variant.key, { allowBackorder: event.target.checked });
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---- Pedacos compartilhados -------------------------------------------------- */

/**
 * A foto da variante, escolhida entre as do produto.
 *
 * A miniatura ao lado do seletor existe porque "Foto 3" nao diz nada: a dona
 * escolhe pelo frasco, e nao pelo numero.
 */
function VariantImage({
  variant,
  index,
  options,
  disabled,
  onUpdate,
  showLabel = false,
}: {
  variant: VariantDraft;
  index: number;
  options: { value: string; label: string }[];
  disabled: boolean;
  onUpdate: (key: string, patch: Partial<VariantDraft>) => void;
  showLabel?: boolean;
}) {
  return (
    <div className={styles.imagePicker}>
      {variant.image === '' ? null : (
        <img
          src={imageUrl(variant.image, 'thumb')}
          alt=""
          width="36"
          height="36"
          loading="lazy"
          decoding="async"
          className={styles.variantThumb}
        />
      )}

      <Select
        label={showLabel ? 'Foto' : `Foto da variante ${String(index + 1)}`}
        hideLabel={!showLabel}
        block
        options={options}
        value={variant.image}
        disabled={disabled || options.length <= 1}
        onChange={(event) => {
          onUpdate(variant.key, { image: event.target.value });
        }}
      />
    </div>
  );
}

function RowButtons({
  index,
  variantKey,
  disabled,
  canRemove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  variantKey: string;
  disabled: boolean;
  canRemove: boolean;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className={styles.buttons}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={`Duplicar a variante ${String(index + 1)}`}
        title="Duplicar"
        disabled={disabled}
        onClick={() => {
          onDuplicate(variantKey);
        }}
      >
        <CopyIcon className={styles.buttonIcon} />
      </button>

      <button
        type="button"
        className={styles.removeButton}
        aria-label={`Remover a variante ${String(index + 1)}`}
        // A ultima nao sai: sem variante, o produto nao tem preco nem estoque,
        // e o servidor recusa o cadastro com 422.
        title={canRemove ? 'Remover' : 'Todo produto precisa de uma variante'}
        disabled={disabled || !canRemove}
        onClick={() => {
          onRemove(variantKey);
        }}
      >
        <TrashIcon className={styles.buttonIcon} />
      </button>
    </div>
  );
}
