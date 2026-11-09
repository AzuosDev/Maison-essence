import { useRef, useState, type DragEvent } from 'react';
import { Button, Input, Switch } from '@/components/ui';
import {
  SETTINGS_LIMITS,
  SHORTCUT_ART,
  UPLOAD_FOLDERS,
  moveShortcut,
  newShortcut,
  useImageUpload,
  type ShortcutDraft,
  type ShortcutErrors,
} from '@/features/admin';
import { imageUrl } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripIcon,
  ImageIcon,
  PlusIcon,
  TrashIcon,
} from './admin-icons';
import { LinkTargetFields, useCategoryOptions, type SelectOption } from './link-target';
import { RowMenu, type RowMenuItem } from './row-menu';
import styles from './shortcut-editor.module.css';

/**
 * A fileira de atalhos da home: os círculos logo abaixo do banner.
 *
 * ## O que esta tela passou a decidir
 *
 * Até ela existir, a fileira era literalmente as categorias-raiz do catálogo
 * na ordem de Categorias — e isso amarrava duas decisões diferentes num
 * campo só. Pôr "Mais vendidos" na primeira tela exigia inventar uma
 * categoria vazia para ele; destacar uma marca exigia transformar a marca em
 * categoria e reclassificar os produtos. Aqui a fileira e lista própria, e a
 * arvore voltou a ser só a organização do catálogo.
 *
 * ## O destino e escolhido, não digitado
 *
 * O servidor guarda um caminho e nada mais. Quem o monta e esta tela, a
 * partir de uma pergunta em duas partes: que tipo de destino, e qual. A
 * categoria sai de um seletor com a arvore inteira, a lista pronta sai de
 * uma lista fechada, e só a marca e o endereço livre se digitam. E a
 * diferença entre uma fileira conferida e uma fileira que aponta para
 * `/categorias/hidrantes` porque alguém trocou uma letra.
 *
 * ## O círculo esta na tela, do tamanho que ele tem na loja
 *
 * A prévia não e uma miniatura quadrada do arquivo: e o círculo como a home o
 * desenha, no diâmetro que ele tem lá, com a inicial por baixo quando não há
 * foto — e com a arte saindo para fora do círculo, que e como a loja mostra.
 *
 * E aqui que a dona descobre o que mais surpreende quem envia foto de
 * catálogo: o disco da arte precisa fechar com o contorno, e o fundo precisa
 * ser transparente. Foto sem disco flutua no meio do círculo, foto com fundo
 * branco desenha um quadrado em volta dele — e as duas aparecem nesta tela
 * antes de aparecerem para a cliente.
 *
 * ## Fileira vazia não e tela quebrada
 *
 * Sem nenhum atalho a home volta a desenhar as categorias principais. O
 * vazio desta tela diz isso em palavras, porque e a única forma de a dona
 * entender por que a loja mostra uma fileira que ela não montou.
 */
export interface ShortcutEditorProps {
  shortcuts: readonly ShortcutDraft[];
  /** Por `key` do rascunho. */
  errors: Record<string, ShortcutErrors> | undefined;
  onChange: (shortcuts: ShortcutDraft[]) => void;
}

export function ShortcutEditor({ shortcuts, errors, onChange }: ShortcutEditorProps) {
  const upload = useImageUpload(UPLOAD_FOLDERS.shortcuts);
  // Uma vez por render da fileira, e não uma por linha. Ver `link-target`.
  const categoryOptions = useCategoryOptions();
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const room = SETTINGS_LIMITS.shortcuts - shortcuts.length;

  const set = (index: number, patch: Partial<ShortcutDraft>): void => {
    onChange(
      shortcuts.map((shortcut, at) => (at === index ? { ...shortcut, ...patch } : shortcut)),
    );
  };

  const drop = (index: number): void => {
    if (dragging !== null) {
      onChange(moveShortcut(shortcuts, dragging, index));
    }

    setDragging(null);
    setOver(null);
  };

  return (
    <div className={styles.editor}>
      {shortcuts.length === 0 ? (
        <p className={styles.empty}>
          A fileira esta vazia, e por isso a home mostra as categorias principais, na ordem de
          Categorias. O primeiro atalho adicionado aqui substitui essa fileira inteira.
        </p>
      ) : (
        <ol className={styles.list}>
          {shortcuts.map((shortcut, index) => (
            /*
              O detector avisa que um `<li>` não deveria ouvir eventos de
              ponteiro, e a preocupação e legitima: um alvo que só responde ao
              arraste não existe para quem usa teclado. Aqui ela esta
              atendida — "Subir" e "Descer" no menu da linha fazem o mesmo, e
              são o caminho principal. O arraste e o atalho de quem tem mouse.
            */
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={shortcut.key}
              className={cx(
                styles.item,
                dragging === index && styles.dragging,
                over === index && dragging !== index && styles.dropTarget,
              )}
              draggable={!upload.isUploading}
              onDragStart={() => {
                setDragging(index);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDragOver={(event: DragEvent) => {
                // Sem isto o navegador recusa o solte: `dragover` só libera o
                // alvo quando o padrão e cancelado.
                event.preventDefault();
                setOver(index);
              }}
              onDrop={(event: DragEvent) => {
                event.preventDefault();
                drop(index);
              }}
            >
              <ShortcutRow
                shortcut={shortcut}
                index={index}
                total={shortcuts.length}
                categoryOptions={categoryOptions}
                errors={errors?.[shortcut.key]}
                busy={upload.isUploading}
                onSet={(patch) => {
                  set(index, patch);
                }}
                onMove={(to) => {
                  onChange(moveShortcut(shortcuts, index, to));
                }}
                onRemove={() => {
                  onChange(shortcuts.filter((_, at) => at !== index));
                }}
                onUpload={(file) => {
                  void upload.send([file]).then((uploaded) => {
                    const [publicId] = uploaded;

                    if (publicId !== undefined) {
                      set(index, { image: publicId });
                    }
                  });
                }}
              />
            </li>
          ))}
        </ol>
      )}

      {upload.error === null ? null : (
        <p className={styles.uploadError} role="alert">
          {upload.error}
        </p>
      )}

      <div className={styles.add}>
        <Button
          type="button"
          variant="secondary"
          disabled={room <= 0}
          onClick={() => {
            onChange([...shortcuts, newShortcut()]);
          }}
        >
          <PlusIcon />
          Adicionar atalho
        </Button>

        <p className={styles.room}>
          {room <= 0
            ? `A fileira esta cheia: ${String(SETTINGS_LIMITS.shortcuts)} círculos e o que cabe numa linha de computador.`
            : 'Comece pelo nome e pelo destino. A foto entra depois, e o círculo vive sem ela.'}
        </p>
      </div>

      <p className={styles.sizes}>
        Medida da foto — {String(SHORTCUT_ART.width)} × {String(SHORTCUT_ART.height)} px, quadrada
        e de fundo transparente. O disco da arte vira o próprio círculo, e o que passar dele — o
        frasco mais alto, a tampa — aparece por fora. Fundo branco vira um quadrado em volta do
        círculo.
      </p>
    </div>
  );
}

/* ---- Uma linha ------------------------------------------------------------------ */

function ShortcutRow({
  shortcut,
  index,
  total,
  categoryOptions,
  errors,
  busy,
  onSet,
  onMove,
  onRemove,
  onUpload,
}: {
  shortcut: ShortcutDraft;
  index: number;
  total: number;
  categoryOptions: readonly SelectOption[];
  errors: ShortcutErrors | undefined;
  busy: boolean;
  onSet: (patch: Partial<ShortcutDraft>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onUpload: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const label = shortcut.label.trim();
  const name = label === '' ? `Atalho ${String(index + 1)}` : label;

  const actions: RowMenuItem[] = [
    {
      label: 'Subir',
      icon: ArrowUpIcon,
      disabled: index === 0,
      onSelect: () => {
        onMove(index - 1);
      },
    },
    {
      label: 'Descer',
      icon: ArrowDownIcon,
      disabled: index === total - 1,
      onSelect: () => {
        onMove(index + 1);
      },
    },
    { label: 'Excluir', icon: TrashIcon, tone: 'danger', separated: true, onSelect: onRemove },
  ];

  return (
    <div className={styles.row}>
      <div className={styles.head}>
        <GripIcon className={styles.grip} aria-hidden="true" />

        <span className={cx(styles.status, shortcut.isActive ? styles.live : styles.off)}>
          {shortcut.isActive ? 'Na fileira' : 'Desligado'}
        </span>

        <span className={styles.name}>{name}</span>

        <Switch
          label={`Mostrar ${name}`}
          hideLabel
          checked={shortcut.isActive}
          onChange={(event) => {
            onSet({ isActive: event.target.checked });
          }}
        />

        <RowMenu label={name} items={actions} />
      </div>

      <div className={styles.body}>
        <div className={styles.art}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(event) => {
              const [file] = event.target.files ?? [];

              if (file !== undefined) {
                onUpload(file);
              }

              event.target.value = '';
            }}
          />

          {/*
            O botão e o próprio círculo, do tamanho que ele tem na loja.

            Uma prévia ao lado de um botão "enviar foto" mostraria duas vezes
            a mesma coisa e deixaria o alvo de clique longe do que ele muda.
            Aqui o que se vê e o que se clica, e o estado vazio e o mesmo
            estado vazio da home: a inicial do nome, em dourado.
          */}
          <button
            type="button"
            className={styles.circleButton}
            disabled={busy}
            onClick={() => {
              fileRef.current?.click();
            }}
          >
            <span className={styles.circle}>
              <span className={styles.initial} aria-hidden="true">
                {name.slice(0, 1).toUpperCase()}
              </span>

              {shortcut.image === '' ? null : (
                <img
                  src={imageUrl(shortcut.image, 'thumb')}
                  alt=""
                  width="104"
                  height="104"
                  loading="lazy"
                  decoding="async"
                  className={styles.image}
                />
              )}
            </span>

            <span className={styles.artLabel}>
              <ImageIcon />
              {shortcut.image === '' ? 'Enviar foto' : 'Trocar foto'}
            </span>
          </button>

          {shortcut.image === '' ? null : (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                onSet({ image: '' });
              }}
            >
              Remover a foto
            </button>
          )}
        </div>

        <div className={styles.fields}>
          <Input
            label="Nome"
            block
            required
            maxLength={SETTINGS_LIMITS.shortcutLabel}
            placeholder="Hidratantes"
            hint="O que a cliente lê embaixo do círculo. Curto: ele tem a largura do círculo."
            value={shortcut.label}
            error={errors?.label}
            onChange={(event) => {
              onSet({ label: event.target.value });
            }}
          />

          <div className={styles.pair}>
            <LinkTargetFields
              kind={shortcut.targetKind}
              value={shortcut.targetValue}
              error={errors?.target}
              categoryOptions={categoryOptions}
              maxLength={SETTINGS_LIMITS.shortcutLink}
              onChange={onSet}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
