import { useRef, useState, type DragEvent } from 'react';
import { Button, Input, Switch } from '@/components/ui';
import {
  BANNER_STATUS_LABELS,
  SETTINGS_LIMITS,
  bannerStatus,
  moveBanner,
  newBanner,
  useImageUpload,
  UPLOAD_FOLDERS,
  type BannerDraft,
  type BannerErrors,
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
import { RowMenu, type RowMenuItem } from './row-menu';
import styles from './banner-editor.module.css';

/**
 * O carrossel da home.
 *
 * ## A arte vem primeiro
 *
 * Adicionar um banner comeca pelo envio da imagem, e nao por um formulario
 * vazio: banner sem arte nao existe — o servidor o recusa —, e uma linha em
 * branco esperando upload e um estado que so serve para ser abandonado.
 *
 * ## Quatro estados, e nao dois
 *
 * "No ar", "Agendado", "Encerrado" e "Desligado" parecem dois na tela e sao
 * quatro na pratica: o desligado volta com um clique, o encerrado precisa de
 * datas novas, e o agendado e o caso que mais assusta — "salvei e nao
 * apareceu". Cada linha diz o seu em palavras.
 *
 * ## O ultimo dia conta inteiro
 *
 * A dona pensa "ate dia 25", e e isso que o campo pergunta. A conversao para
 * o instante em que o banner sai do ar acontece na saida, em
 * `bannerToInput` — aqui so se escolhe o dia.
 */
export interface BannerEditorProps {
  banners: readonly BannerDraft[];
  /** Por `key` do rascunho. */
  errors: Record<string, BannerErrors> | undefined;
  onChange: (banners: BannerDraft[]) => void;
}

export function BannerEditor({ banners, errors, onChange }: BannerEditorProps) {
  const upload = useImageUpload(UPLOAD_FOLDERS.banners);
  const addRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  // O relogio e lido uma vez por render, e nao uma vez por linha: duas
  // leituras podem cair em lados diferentes da meia-noite, e duas linhas
  // agendadas para o mesmo dia apareceriam em estados diferentes.
  const now = new Date();
  const room = SETTINGS_LIMITS.banners - banners.length;

  const set = (index: number, patch: Partial<BannerDraft>): void => {
    onChange(banners.map((banner, at) => (at === index ? { ...banner, ...patch } : banner)));
  };

  const add = async (files: FileList | null): Promise<void> => {
    if (files === null || files.length === 0) {
      return;
    }

    const uploaded = await upload.send([...files].slice(0, Math.max(room, 0)));

    onChange([...banners, ...uploaded.map(newBanner)]);
  };

  const drop = (index: number): void => {
    if (dragging !== null) {
      onChange(moveBanner(banners, dragging, index));
    }

    setDragging(null);
    setOver(null);
  };

  return (
    <div className={styles.editor}>
      {banners.length === 0 ? (
        <p className={styles.empty}>
          A home ainda nao tem carrossel. Sem banner, ela comeca direto pelos produtos — o que
          funciona, mas deixa de contar o que a loja quer contar primeiro.
        </p>
      ) : (
        <ol className={styles.list}>
          {banners.map((banner, index) => (
            /*
              O detector avisa que um `<li>` nao deveria ouvir eventos de
              ponteiro, e a preocupacao e legitima: um alvo que so responde ao
              arraste nao existe para quem usa teclado. Aqui ela esta
              atendida — "Subir" e "Descer" no menu da linha fazem o mesmo, e
              sao o caminho principal. O arraste e o atalho de quem tem mouse.
            */
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <li
              key={banner.key}
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
              <BannerRow
                banner={banner}
                index={index}
                total={banners.length}
                status={bannerStatus(banner, now)}
                errors={errors?.[banner.key]}
                busy={upload.isUploading}
                onSet={(patch) => {
                  set(index, patch);
                }}
                onMove={(to) => {
                  onChange(moveBanner(banners, index, to));
                }}
                onRemove={() => {
                  onChange(banners.filter((_, at) => at !== index));
                }}
                onUploadMobile={(file) => {
                  void upload.send([file]).then((uploaded) => {
                    const [publicId] = uploaded;

                    if (publicId !== undefined) {
                      set(index, { imageMobile: publicId });
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
          loadingLabel={
            upload.progress === null
              ? 'Enviando'
              : `Enviando ${String(upload.progress.done + 1)} de ${String(upload.progress.total)}`
          }
          onClick={() => {
            addRef.current?.click();
          }}
        >
          <PlusIcon />
          Adicionar banner
        </Button>

        <p className={styles.room}>
          {room <= 0
            ? `O carrossel esta cheio: ${String(SETTINGS_LIMITS.banners)} banners e o maximo que alguem assiste ate o fim.`
            : 'Comece pela arte de computador. Ela e obrigatoria; a de celular entra depois.'}
        </p>
      </div>
    </div>
  );
}

/* ---- Uma linha ------------------------------------------------------------------ */

function BannerRow({
  banner,
  index,
  total,
  status,
  errors,
  busy,
  onSet,
  onMove,
  onRemove,
  onUploadMobile,
}: {
  banner: BannerDraft;
  index: number;
  total: number;
  status: ReturnType<typeof bannerStatus>;
  errors: BannerErrors | undefined;
  busy: boolean;
  onSet: (patch: Partial<BannerDraft>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
  onUploadMobile: (file: File) => void;
}) {
  const mobileRef = useRef<HTMLInputElement>(null);
  const name = banner.title.trim() === '' ? `Banner ${String(index + 1)}` : banner.title.trim();

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

        <span className={cx(styles.status, styles[status])}>{BANNER_STATUS_LABELS[status]}</span>

        <span className={styles.name}>{name}</span>

        <Switch
          label={`Mostrar ${name}`}
          hideLabel
          checked={banner.isActive}
          onChange={(event) => {
            onSet({ isActive: event.target.checked });
          }}
        />

        <RowMenu label={name} items={actions} />
      </div>

      <div className={styles.body}>
        <div className={styles.arts}>
          <img
            src={imageUrl(banner.imageDesktop, 'card')}
            alt={`Arte de computador de ${name}`}
            width="320"
            height="180"
            loading="lazy"
            decoding="async"
            className={styles.art}
          />

          <input
            ref={mobileRef}
            type="file"
            accept="image/*"
            className="visually-hidden"
            onChange={(event) => {
              const [file] = event.target.files ?? [];

              if (file !== undefined) {
                onUploadMobile(file);
              }

              event.target.value = '';
            }}
          />

          {banner.imageMobile === '' ? (
            <button
              type="button"
              className={styles.mobileSlot}
              disabled={busy}
              onClick={() => {
                mobileRef.current?.click();
              }}
            >
              <ImageIcon />
              Enviar arte de celular
            </button>
          ) : (
            <div className={styles.mobileArt}>
              <img
                src={imageUrl(banner.imageMobile, 'thumb')}
                alt={`Arte de celular de ${name}`}
                width="90"
                height="160"
                loading="lazy"
                decoding="async"
                className={styles.portrait}
              />

              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  onSet({ imageMobile: '' });
                }}
              >
                Remover a arte de celular
              </button>
            </div>
          )}

          {errors?.imageDesktop === undefined ? null : (
            <p className={styles.fieldError} role="alert">
              {errors.imageDesktop}
            </p>
          )}
        </div>

        <div className={styles.fields}>
          <Input
            label="Titulo"
            block
            maxLength={SETTINGS_LIMITS.bannerTitle}
            placeholder="Colecao de verao"
            hint="Some da arte quando vazio. A imagem continua clicavel."
            value={banner.title}
            error={errors?.title}
            onChange={(event) => {
              onSet({ title: event.target.value });
            }}
          />

          <Input
            label="Linha de apoio"
            block
            maxLength={SETTINGS_LIMITS.bannerSubtitle}
            placeholder="Notas citricas para os dias quentes"
            value={banner.subtitle}
            error={errors?.subtitle}
            onChange={(event) => {
              onSet({ subtitle: event.target.value });
            }}
          />

          <div className={styles.pair}>
            <Input
              label="Texto do botao"
              block
              maxLength={SETTINGS_LIMITS.bannerButtonLabel}
              placeholder="Ver a colecao"
              value={banner.buttonLabel}
              error={errors?.buttonLabel}
              onChange={(event) => {
                onSet({ buttonLabel: event.target.value });
              }}
            />

            <Input
              label="Leva para"
              block
              maxLength={SETTINGS_LIMITS.bannerLink}
              placeholder="/produtos"
              hint="Um caminho da loja, como /produtos, ou um endereco inteiro."
              value={banner.link}
              error={errors?.link}
              onChange={(event) => {
                onSet({ link: event.target.value });
              }}
            />
          </div>

          <div className={styles.pair}>
            <Input
              label="Primeiro dia"
              block
              type="date"
              hint="Em branco, entra assim que for salvo."
              value={banner.startsOn}
              onChange={(event) => {
                onSet({ startsOn: event.target.value });
              }}
            />

            <Input
              label="Ultimo dia"
              block
              type="date"
              hint="O dia inteiro conta. Em branco, fica ate ser desligado."
              value={banner.endsOn}
              error={errors?.window}
              onChange={(event) => {
                onSet({ endsOn: event.target.value });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
