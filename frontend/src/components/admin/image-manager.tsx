import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { Button, Spinner } from '@/components/ui';
import { PRODUCT_LIMITS, moveImage, removeImage, setCover } from '@/features/admin';
import { imageUrl } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { PinIcon, TrashIcon, UploadIcon } from './admin-icons';
import styles from './image-manager.module.css';

/**
 * As fotos do produto: enviar, reordenar, escolher a capa.
 *
 * ## A ordem e a capa sao a mesma coisa
 *
 * Nao ha campo de capa no cadastro. A **primeira** foto do array e a capa, e
 * por isso arrastar uma foto para o inicio e o gesto que a promove. O botao
 * "Definir como capa" existe porque o gesto sozinho nao se anuncia — e ele
 * que ensina a regra na primeira vez.
 *
 * ## Arrastar nao pode ser o unico jeito
 *
 * Arrastar e o gesto rapido no desktop, e no celular ele briga com a rolagem
 * da pagina. Cada foto tem, alem dele, dois botoes de mover — e sao eles que
 * funcionam no teclado. Uma galeria que so responde ao arraste e uma galeria
 * que metade das pessoas nao consegue ordenar.
 *
 * ## O que acontece com a foto de um cadastro nao salvo
 *
 * Ela fica na conta do Cloudinary sem produto apontando para ela.
 * `use-image-upload.ts` explica por que a limpeza nao acontece aqui.
 */

export interface ImageManagerProps {
  /** `publicId`s na ordem de exibicao. A primeira e a capa. */
  images: readonly string[];
  onChange: (images: string[]) => void;
  /** Envia os arquivos e devolve os `publicId`s que entraram. */
  onUpload: (files: readonly File[]) => Promise<string[]>;
  isUploading?: boolean;
  /** "3 de 5 — asad.jpg". Vem de `useImageUpload`. */
  progressLabel?: string | undefined;
  error?: string | null;
  disabled?: boolean;
}

export function ImageManager({
  images,
  onChange,
  onUpload,
  isUploading = false,
  progressLabel,
  error,
  disabled = false,
}: ImageManagerProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const room = PRODUCT_LIMITS.images - images.length;
  const busy = disabled || isUploading;

  const receive = async (files: FileList | null): Promise<void> => {
    if (files === null || files.length === 0) {
      return;
    }

    // O corte acontece antes do envio: mandar doze fotos para descobrir que
    // so tres cabem gastaria a rede da dona por nada.
    const accepted = [...files].slice(0, Math.max(room, 0));
    const uploaded = await onUpload(accepted);

    if (uploaded.length > 0) {
      onChange([...images, ...uploaded]);
    }
  };

  const drop = (index: number): void => {
    if (dragging !== null) {
      onChange(moveImage(images, dragging, index));
    }

    setDragging(null);
    setOver(null);
  };

  return (
    <div className={styles.manager}>
      {images.length === 0 ? null : (
        <ul className={styles.grid}>
          {images.map((publicId, index) => (
            /*
              O detector avisa que um `<li>` nao deveria ouvir eventos de
              ponteiro, e a preocupacao dele e legitima: um alvo que so
              responde ao arraste nao existe para quem usa teclado. Aqui ela
              esta atendida — os quatro botoes dentro do item fazem tudo o que
              o arraste faz, e sao eles o caminho principal. O arraste e o
              atalho de quem tem mouse.
            */
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={publicId}
              className={cx(
                styles.item,
                index === 0 && styles.cover,
                over === index && dragging !== index && styles.dropTarget,
              )}
              draggable={!busy}
              onDragStart={() => {
                setDragging(index);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDragOver={(event: DragEvent) => {
                // Sem isto o navegador recusa o solte: `dragover` so libera o
                // alvo quando o padrao e cancelado.
                event.preventDefault();
                setOver(index);
              }}
              onDrop={(event: DragEvent) => {
                event.preventDefault();
                drop(index);
              }}
            >
              <img
                src={imageUrl(publicId, 'thumb')}
                alt={index === 0 ? 'Foto de capa' : `Foto ${String(index + 1)}`}
                width="140"
                height="140"
                loading="lazy"
                decoding="async"
                className={styles.image}
              />

              {index === 0 ? <span className={styles.coverTag}>Capa</span> : null}

              <div className={styles.tools}>
                <ToolButton
                  label={`Mover a foto ${String(index + 1)} para tras`}
                  disabled={busy || index === 0}
                  onClick={() => {
                    onChange(moveImage(images, index, index - 1));
                  }}
                >
                  <span aria-hidden="true">&larr;</span>
                </ToolButton>

                <ToolButton
                  label={`Usar a foto ${String(index + 1)} como capa`}
                  disabled={busy || index === 0}
                  onClick={() => {
                    onChange(setCover(images, index));
                  }}
                >
                  <PinIcon className={styles.toolIcon} />
                </ToolButton>

                <ToolButton
                  label={`Tirar a foto ${String(index + 1)} do produto`}
                  tone="danger"
                  disabled={busy}
                  onClick={() => {
                    onChange(removeImage(images, index));
                  }}
                >
                  <TrashIcon className={styles.toolIcon} />
                </ToolButton>

                <ToolButton
                  label={`Mover a foto ${String(index + 1)} para frente`}
                  disabled={busy || index === images.length - 1}
                  onClick={() => {
                    onChange(moveImage(images, index, index + 1));
                  }}
                >
                  <span aria-hidden="true">&rarr;</span>
                </ToolButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="visually-hidden"
          disabled={busy || room <= 0}
          onChange={(event) => {
            void receive(event.target.files);
            // Zera o campo: escolher o mesmo arquivo duas vezes seguidas nao
            // dispara `change` de novo se o valor continuar la.
            event.target.value = '';
          }}
        />

        <Button
          type="button"
          variant="secondary"
          disabled={busy || room <= 0}
          onClick={() => {
            input.current?.click();
          }}
        >
          {isUploading ? <Spinner size="small" /> : <UploadIcon />}
          {images.length === 0 ? 'Enviar fotos' : 'Enviar mais fotos'}
        </Button>

        <p className={styles.hint}>
          {isUploading && progressLabel !== undefined
            ? progressLabel
            : room <= 0
              ? `Sao no maximo ${String(PRODUCT_LIMITS.images)} fotos. Tire uma para enviar outra.`
              : images.length === 0
                ? 'A primeira foto vira a capa, e e ela que aparece na vitrine.'
                : `Arraste para reordenar. Cabem mais ${String(room)}.`}
        </p>
      </div>

      {error === null || error === undefined || error === '' ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  tone?: 'danger';
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cx(styles.tool, tone === 'danger' && styles.toolDanger)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
