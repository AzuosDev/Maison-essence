import { useRef, useState } from 'react';
import { Button, Input, Switch } from '@/components/ui';
import {
  POSTER_ART,
  SETTINGS_LIMITS,
  UPLOAD_FOLDERS,
  movePoster,
  newPoster,
  useImageUpload,
  type PosterDraft,
  type PosterErrors,
} from '@/features/admin';
import { imageUrl } from '@/lib/cloudinary';
import { cx } from '@/lib/cx';
import { ArrowDownIcon, ArrowUpIcon, ImageIcon, PlusIcon, TrashIcon } from './admin-icons';
import { LinkTargetFields, useCategoryOptions, type SelectOption } from './link-target';
import { RowMenu, type RowMenuItem } from './row-menu';
import styles from './poster-editor.module.css';

/**
 * A faixa de cartazes de coleção: as duas artes largas do meio da home.
 *
 * ## O que esta tela passou a decidir
 *
 * Até ela existir, a faixa era literalmente as duas categorias-raiz com mais
 * produtos que tivessem foto. Ninguém escolhia: o catálogo escolhia, e a
 * faixa trocava sozinha quando ele crescia. Destacar "Victoria's Secret", que
 * e marca, ou "Mais vendidos", que não e categoria nenhuma, era impossível
 * sem inventar uma categoria vazia e reclassificar produto.
 *
 * ## A prévia e o cartaz, e não uma miniatura dele
 *
 * O que se vê aqui e o que a home desenha: a arte na moldura 16:9, o véu
 * escuro no pe, o nome e o "VER A COLEÇÃO" no canto inferior esquerdo — e o
 * nome aparece enquanto esta sendo digitado. E a única forma de a dona
 * descobrir, antes da cliente, que o texto caiu em cima do frasco.
 *
 * O enquadramento também e conferido: a moldura tem proporção fixa e corta
 * pelo centro o que não for 16:9, então a arte fora de medida vira um aviso
 * escrito com o que vai ser cortado — e não um recorte silencioso.
 *
 * ## Dois, e nunca um
 *
 * O desenho da faixa são duas colunas. Com um cartaz só a home não desenha a
 * faixa — não desenha meia faixa —, e sem nenhum ela volta as categorias.
 * Esses três estados são a razão de o aviso da tela existir: nenhum deles e
 * erro, e os três mudam a home de um jeito que ninguém adivinha daqui.
 */
export interface PosterEditorProps {
  posters: readonly PosterDraft[];
  /** Por `key` do rascunho. */
  errors: Record<string, PosterErrors> | undefined;
  onChange: (posters: PosterDraft[]) => void;
}

export function PosterEditor({ posters, errors, onChange }: PosterEditorProps) {
  const upload = useImageUpload(UPLOAD_FOLDERS.posters);
  // Uma vez por render da faixa, e não uma por linha. Ver `link-target`.
  const categoryOptions = useCategoryOptions();
  const addRef = useRef<HTMLInputElement>(null);

  const room = SETTINGS_LIMITS.posters - posters.length;

  const set = (index: number, patch: Partial<PosterDraft>): void => {
    onChange(posters.map((poster, at) => (at === index ? { ...poster, ...patch } : poster)));
  };

  /*
   * O cartaz nasce da arte, e não vazio.
   *
   * Ao contrário do atalho, que vive sem foto caindo na inicial do nome: a
   * faixa não desenha cartaz sem arte, então uma linha vazia na lista seria
   * uma linha que só sabe dizer o que falta.
   */
  const add = async (files: FileList | null): Promise<void> => {
    if (files === null || files.length === 0) {
      return;
    }

    const uploaded = await upload.send([...files].slice(0, Math.max(room, 0)));

    onChange([...posters, ...uploaded.map(newPoster)]);
  };

  return (
    <div className={styles.editor}>
      {posters.length === 0 ? (
        <p className={styles.empty}>
          A faixa esta vazia, e por isso a home mostra as duas categorias com mais produtos que
          tenham foto. Os cartazes adicionados aqui substituem essa dupla — e a faixa precisa dos
          dois para aparecer.
        </p>
      ) : (
        <ol className={styles.list}>
          {posters.map((poster, index) => (
            <li key={poster.key}>
              <PosterRow
                poster={poster}
                index={index}
                total={posters.length}
                categoryOptions={categoryOptions}
                errors={errors?.[poster.key]}
                busy={upload.isUploading}
                onSet={(patch) => {
                  set(index, patch);
                }}
                onMove={(to) => {
                  onChange(movePoster(posters, index, to));
                }}
                onRemove={() => {
                  onChange(posters.filter((_, at) => at !== index));
                }}
                onUpload={(file) => {
                  void upload.send([file]).then((sent) => {
                    const [publicId] = sent;

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
        <input
          ref={addRef}
          type="file"
          accept="image/*"
          multiple
          className="visually-hidden"
          onChange={(event) => {
            void add(event.target.files);
            event.target.value = '';
          }}
        />

        <Button
          type="button"
          variant="secondary"
          disabled={room <= 0}
          loading={upload.isUploading}
          loadingLabel="Enviando"
          onClick={() => {
            addRef.current?.click();
          }}
        >
          <PlusIcon />
          Adicionar cartaz
        </Button>

        <p className={styles.room}>
          {room <= 0
            ? 'A faixa esta completa: ela são duas colunas, e dois cartazes e o que a home desenha.'
            : posters.length === 1
              ? 'Falta o segundo: com um cartaz só, a faixa não aparece na home.'
              : 'Comece pela arte. O nome e o destino entram depois dela.'}
        </p>
      </div>

      <p className={styles.sizes}>
        Medida da arte — {String(POSTER_ART.width)} × {String(POSTER_ART.height)} px, exatamente
        16:9. A moldura da home tem essa proporção fixa e corta pelo centro o que fugir dela. O pe
        do cartaz recebe o véu escuro e o texto: deixe o produto no alto e a esquerda livre.
      </p>
    </div>
  );
}

/* ---- Uma linha ------------------------------------------------------------------ */

function PosterRow({
  poster,
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
  poster: PosterDraft;
  index: number;
  total: number;
  categoryOptions: readonly SelectOption[];
  errors: PosterErrors | undefined;
  busy: boolean;
  onSet: (patch: Partial<PosterDraft>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onUpload: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const label = poster.label.trim();
  const name = label === '' ? `Cartaz ${String(index + 1)}` : label;

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
        <span className={cx(styles.status, poster.isActive ? styles.live : styles.off)}>
          {poster.isActive ? 'Na faixa' : 'Desligado'}
        </span>

        <span className={styles.name}>{name}</span>

        <Switch
          label={`Mostrar ${name}`}
          hideLabel
          checked={poster.isActive}
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

          <PosterPreview
            poster={poster}
            name={label}
            busy={busy}
            onPick={() => {
              fileRef.current?.click();
            }}
          />

          {errors?.image === undefined ? null : (
            <p className={styles.artError}>{errors.image}</p>
          )}
        </div>

        <div className={styles.fields}>
          <Input
            label="Nome"
            block
            required
            maxLength={SETTINGS_LIMITS.posterLabel}
            placeholder="Victoria's Secret"
            hint="O nome grande, escrito sobre a arte."
            value={poster.label}
            error={errors?.label}
            onChange={(event) => {
              onSet({ label: event.target.value });
            }}
          />

          <Input
            label="Linha de apoio"
            block
            maxLength={SETTINGS_LIMITS.posterCaption}
            placeholder="41 produtos"
            hint="Opcional, embaixo do nome. Vazia, ela some do cartaz."
            value={poster.caption}
            error={errors?.caption}
            onChange={(event) => {
              onSet({ caption: event.target.value });
            }}
          />

          <div className={styles.pair}>
            <LinkTargetFields
              kind={poster.targetKind}
              value={poster.targetValue}
              error={errors?.target}
              categoryOptions={categoryOptions}
              maxLength={SETTINGS_LIMITS.posterLink}
              onChange={onSet}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- A prévia -------------------------------------------------------------------- */

/**
 * Quanto a proporção pode fugir de 16:9 antes de virar aviso.
 *
 * 1% de folga: 1920 × 1081 e um arredondamento de quem exportou, e não um
 * enquadramento errado. O que esta fora disso perde faixa de imagem visível.
 */
const RATIO_TOLERANCE = 0.01;

/** Abaixo disto a arte chega mole num monitor grande. Ver `POSTER_ART`. */
const MIN_WIDTH = 1200;

/**
 * O cartaz do jeito que a home o desenha.
 *
 * O botão e o próprio cartaz: uma prévia ao lado de um botão "enviar arte"
 * mostraria duas vezes a mesma coisa e deixaria o alvo de clique longe do que
 * ele muda.
 *
 * As medidas do texto estão em `cqw` — porcentagem da largura do cartaz —, e
 * não em `rem`: e o que mantem a proporção entre o nome e a arte igual a da
 * home, em qualquer largura que esta tela tenha. Com `rem`, a prévia mostraria
 * um nome proporcionalmente maior do que o da loja, e a dona ajustaria a arte
 * para um problema que não existe.
 */
function PosterPreview({
  poster,
  name,
  busy,
  onPick,
}: {
  poster: PosterDraft;
  /** O nome em edição, já sem espaços nas pontas. Vazio mostra o lugar dele. */
  name: string;
  busy: boolean;
  onPick: () => void;
}) {
  /*
   * A medida real da arte, lida da imagem que o navegador acabou de carregar.
   *
   * A entrega do Cloudinary reduz e nunca amplia, e preserva a proporção —
   * então a imagem carregada responde as duas perguntas que importam: se a
   * arte e 16:9 e se ela tem pixels suficientes. Medir aqui, e não no envio,
   * e o que faz o aviso continuar na tela quando a dona reabre Ajustes.
   */
  const [measure, setMeasure] = useState<{ width: number; height: number } | null>(null);
  const caption = poster.caption.trim();
  const problem = measure === null ? null : framingProblem(measure);

  return (
    <>
      <button type="button" className={styles.frameButton} disabled={busy} onClick={onPick}>
        <span className={styles.frame}>
          <img
            src={imageUrl(poster.image, 'detail')}
            alt=""
            className={styles.image}
            loading="lazy"
            decoding="async"
            onLoad={(event) => {
              setMeasure({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              });
            }}
          />

          {/* O mesmo véu da home, e pelo mesmo motivo: ele escurece só o pe,
              que e onde o texto cai. Ver `collection-posters.module.css`. */}
          <span className={styles.scrim} />

          <span className={styles.caption}>
            <span className={cx(styles.posterName, name === '' && styles.placeholder)}>
              {name === '' ? 'Nome do cartaz' : name}
            </span>

            {caption === '' ? null : <span className={styles.posterCount}>{caption}</span>}

            <span className={styles.action}>Ver a coleção</span>
          </span>
        </span>

        <span className={styles.artLabel}>
          <ImageIcon />
          Trocar a arte
        </span>
      </button>

      {problem === null ? null : <p className={styles.framing}>{problem}</p>}
    </>
  );
}

/**
 * O que esta arte vai perder na moldura da home, escrito.
 *
 * Aviso, e não recusa: a arte fora de medida continua sendo publicável, e
 * pode ser a única que a dona tem hoje. O que ela não pode e descobrir o
 * corte pela vitrine.
 */
function framingProblem(measure: { width: number; height: number }): string | null {
  const ratio = measure.width / measure.height;
  const target = POSTER_ART.width / POSTER_ART.height;
  const medida = `${String(measure.width)} × ${String(measure.height)} px`;

  if (Math.abs(ratio - target) > RATIO_TOLERANCE) {
    return ratio > target
      ? `A arte tem ${medida} e e mais larga que 16:9: a home corta as laterais pelo centro.`
      : `A arte tem ${medida} e e mais alta que 16:9: a home corta o topo e o pe pelo centro.`;
  }

  if (measure.width < MIN_WIDTH) {
    return `A arte tem ${medida} e fica mole num monitor grande — o ideal e ${String(POSTER_ART.width)} × ${String(POSTER_ART.height)}.`;
  }

  return null;
}
