import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  ArrowLeftIcon,
  CategoryPicker,
  ConfirmDialog,
  ImageManager,
  VariantsEditor,
} from '@/components/admin';
import { Button, EmptyState, Input, Skeleton, Switch, Textarea, useToast } from '@/components/ui';
import {
  PRODUCT_LIMITS,
  canManageStore,
  draftFromProduct,
  draftToCreate,
  draftToUpdate,
  emptyProductDraft,
  hasErrors,
  useAdminCategories,
  useAdminRole,
  useDeleteProduct,
  useImageUpload,
  useProduct,
  useSaveProduct,
  validateDraft,
  type ProductDraft,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-product-form-page.module.css';

/**
 * O cadastro do produto, em pagina cheia.
 *
 * ## Por que nao e um modal
 *
 * Porque nao e uma tarefa curta. Sao nove campos, uma galeria e uma tabela de
 * variantes, e a dona faz isso no celular com a caixa do fornecedor aberta ao
 * lado. Um modal rouba a rolagem da pagina, nao tem endereco proprio para ela
 * voltar depois de uma ligacao, e no celular vira uma pagina cheia com uma
 * borda inutil em volta.
 *
 * Em pagina cheia, `/admin/produtos/novo` e `/admin/produtos/:id` sao
 * enderecos: ela pode sair, voltar e continuar.
 *
 * ## A ordem das secoes e a ordem da caixa
 *
 * Nome e marca primeiro, porque e o que esta escrito no frasco. Fotos em
 * seguida, porque e o que ela acabou de tirar. Variantes depois, porque e
 * preciso ver as fotos para dizer qual e a do frasco de 50 ml. Categorias e
 * vitrine por ultimo, que sao decisoes sobre onde o produto aparece — e nao
 * sobre o que ele e.
 *
 * ## Os erros so aparecem depois da primeira tentativa
 *
 * Validar a cada tecla marcaria o campo de preco como invalido enquanto a
 * pessoa digita `1`, `19`, `199,`. O formulario so mostra erro depois que
 * alguem tentou salvar — e a partir dai ele corrige ao vivo, porque nesse
 * ponto a pessoa ja sabe o que esta errado e quer ver quando consertou.
 */
export default function AdminProductFormPage() {
  const { id } = useParams();
  const role = useAdminRole();

  // `/admin/produtos/novo` casa com `:id` — e a mesma rota. O literal e o que
  // separa o cadastro novo da edicao, e ele nao pode ser um id valido porque
  // `novo` nao e hexadecimal de 24 caracteres.
  const isNew = id === undefined || id === 'novo';
  const productId = isNew ? '' : id;

  const { data: product, isPending, isError, error } = useProduct(productId);

  usePageMeta({
    title: isNew ? 'Novo produto — Painel' : `${product?.name ?? 'Produto'} — Painel`,
    description: 'Acesso restrito.',
  });

  if (!canManageStore(role)) {
    return (
      <EmptyState
        as="h1"
        title="Esta area e de quem administra a loja"
        description="O seu acesso cobre o atendimento: o inicio do painel e os pedidos. Quem cadastra produto responde pelo preco e pelo estoque."
        actions={
          <Link to={ROUTES.admin.root} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para o inicio
          </Link>
        }
      />
    );
  }

  if (!isNew && isError) {
    return (
      <EmptyState
        as="h1"
        title="Este produto nao abriu"
        description={errorMessage(error)}
        actions={
          <Link to={ROUTES.admin.products} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para o catalogo
          </Link>
        }
      />
    );
  }

  if (!isNew && (isPending || product === undefined)) {
    return <FormSkeleton />;
  }

  return (
    <ProductForm
      key={product?.id ?? 'novo'}
      initial={product === undefined ? emptyProductDraft() : draftFromProduct(product)}
      productId={product?.id}
      productName={product?.name ?? ''}
      productSlug={product?.slug ?? ''}
    />
  );
}

/* ---- O formulario --------------------------------------------------------- */

function ProductForm({
  initial,
  productId,
  productName,
  productSlug,
}: {
  initial: ProductDraft;
  productId: string | undefined;
  productName: string;
  productSlug: string;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [draft, setDraft] = useState(initial);
  const [tried, setTried] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: categories } = useAdminCategories();
  const upload = useImageUpload();
  const save = useSaveProduct();
  const remove = useDeleteProduct();

  const isNew = productId === undefined;
  const errors = validateDraft(draft);
  // Enquanto ninguem tentou salvar, a tela nao marca nada de vermelho. Ver a
  // nota no topo do arquivo.
  const shown = tried ? errors : { variant: {} };

  const set = (patch: Partial<ProductDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const submit = (): void => {
    setTried(true);

    if (hasErrors(errors)) {
      // O primeiro campo invalido recebe o foco: num formulario desta altura,
      // um erro la embaixo passaria despercebido no celular.
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();

      return;
    }

    // Corpos diferentes, e nao o mesmo com um campo a mais: a criacao pode
    // escolher o endereco do produto, a edicao nao mexe nele.
    save.mutate(
      productId === undefined
        ? { input: draftToCreate(draft) }
        : { id: productId, input: draftToUpdate(draft) },
      {
        onSuccess: (saved) => {
          toast({
            variant: 'success',
            title: isNew ? `${saved.name} foi cadastrado` : `${saved.name} foi salvo`,
            description: saved.isActive
              ? 'Ja esta no ar na vitrine.'
              : 'Fica guardado fora do ar ate voce publicar.',
          });

          void navigate(ROUTES.admin.products);
        },
        onError: (cause) => {
          toast({
            variant: 'danger',
            title: 'O cadastro nao foi salvo',
            description: errorMessage(cause),
          });
        },
      },
    );
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.admin.products} className={styles.backLink}>
          <ArrowLeftIcon />
          Produtos
        </Link>

        <h1 className={styles.title}>{isNew ? 'Novo produto' : productName}</h1>

        {isNew || productSlug === '' ? null : (
          <p className={styles.address}>
            Endereco na loja: <code>/produtos/{productSlug}</code>
          </p>
        )}
      </header>

      {/*
        `noValidate`: a validacao e a nossa, em portugues e com as regras do
        servidor. A do navegador apareceria em cima dela, numa bolha que some
        sozinha e que o leitor de tela nao anuncia.
      */}
      <form
        noValidate
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Section title="O produto">
          <Input
            label="Nome"
            block
            required
            maxLength={PRODUCT_LIMITS.name}
            placeholder="Asad"
            value={draft.name}
            error={shown.name}
            onChange={(event) => {
              set({ name: event.target.value });
            }}
          />

          <Input
            label="Marca"
            block
            maxLength={PRODUCT_LIMITS.brand}
            placeholder="Lattafa"
            hint="Aparece no card e agrupa a vitrine por marca."
            value={draft.brand}
            error={shown.brand}
            onChange={(event) => {
              set({ brand: event.target.value });
            }}
          />

          {isNew ? (
            <Input
              label="Endereco na loja"
              block
              maxLength={PRODUCT_LIMITS.slug}
              placeholder="sai do nome"
              hint="So pode ser escolhido agora: depois de publicado, o link ja foi para o WhatsApp de alguem."
              value={draft.slug}
              error={shown.slug}
              onChange={(event) => {
                set({ slug: event.target.value });
              }}
            />
          ) : null}

          <Textarea
            label="Descricao"
            block
            rows={6}
            showCount
            maxLength={PRODUCT_LIMITS.description}
            hint="Notas, fixacao, para quem e. E o texto da pagina do produto."
            value={draft.description}
            error={shown.description}
            onChange={(event) => {
              set({ description: event.target.value });
            }}
          />
        </Section>

        <Section
          title="Fotos"
          note="A primeira e a capa: e ela que aparece na vitrine e no WhatsApp."
        >
          <ImageManager
            images={draft.images}
            onChange={(images) => {
              // A variante que apontava para uma foto removida volta a usar a
              // capa. Sem isto, o cadastro sairia com um `publicId` que o
              // produto nao tem mais, e o servidor recusaria o salvamento
              // inteiro por causa de uma foto que a dona ja tirou da tela.
              const kept = new Set(images);

              setDraft((current) => ({
                ...current,
                images,
                variants: current.variants.map((variant) =>
                  variant.image === '' || kept.has(variant.image)
                    ? variant
                    : { ...variant, image: '' },
                ),
              }));
            }}
            onUpload={upload.send}
            isUploading={upload.isUploading}
            progressLabel={progressLabel(upload.progress)}
            error={upload.error}
          />

          {shown.images === undefined ? null : (
            <p className={styles.fieldError} role="alert">
              {shown.images}
            </p>
          )}
        </Section>

        <Section
          title="Variantes"
          note="O preco, o SKU e o estoque moram aqui. Um produto de frasco unico tem uma variante sem nome."
        >
          <VariantsEditor
            variants={draft.variants}
            images={draft.images}
            errors={shown}
            onChange={(variants) => {
              set({ variants });
            }}
          />
        </Section>

        {/*
          A vitrine vem antes das categorias, e nao depois.

          As tres decisoes daqui sao curtas e valem para o produto inteiro —
          esta no ar, e destaque, esta na prateleira —, enquanto a arvore de
          categorias tem dezenas de linhas e rola. Deixa-las embaixo dela
          escondia os tres interruptores no fim de uma lista longa, e o
          "Publicado" e justamente o que se confere por ultimo antes de salvar.
        */}
        <Section title="Vitrine">
          <div className={styles.switches}>
            <Switch
              label="Publicado"
              checked={draft.isActive}
              onChange={(event) => {
                set({ isActive: event.target.checked });
              }}
            />

            <Switch
              label="Destaque na home"
              checked={draft.isFeatured}
              onChange={(event) => {
                set({ isFeatured: event.target.checked });
              }}
            />

            <Switch
              label="Pronta entrega"
              checked={draft.isReadyToShip}
              onChange={(event) => {
                set({ isReadyToShip: event.target.checked });
              }}
            />
          </div>
        </Section>

        <Section title="Onde aparece" note="Um produto sem categoria so e encontrado pela busca.">
          <CategoryPicker
            tree={categories ?? []}
            selected={draft.categoryIds}
            onChange={(categoryIds) => {
              set({ categoryIds });
            }}
          />
        </Section>

        {/*
          A barra de acoes gruda no pe da tela.

          O formulario tem cinco secoes e rola bastante; um botao de salvar la
          embaixo obrigaria a percorrer tudo de volta depois de corrigir um
          campo no meio. Grudada, ela tambem e o lugar onde o aviso de erro
          aparece — ao lado do botao que a pessoa acabou de apertar.
        */}
        <div className={styles.bar}>
          {tried && hasErrors(errors) ? (
            <p className={styles.barError} role="alert">
              Falta corrigir alguma coisa acima.
            </p>
          ) : null}

          <div className={styles.barActions}>
            {isNew ? null : (
              <Button
                type="button"
                variant="ghost"
                className={styles.delete}
                onClick={() => {
                  setConfirmingDelete(true);
                }}
              >
                Excluir
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigate(ROUTES.admin.products);
              }}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              loading={save.isPending}
              loadingLabel="Salvando"
              disabled={upload.isUploading}
            >
              {isNew ? 'Cadastrar produto' : 'Salvar'}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => {
          setConfirmingDelete(false);
        }}
        onConfirm={() => {
          if (productId === undefined) {
            return;
          }

          remove.mutate(productId, {
            onSuccess: () => {
              toast({ variant: 'success', title: `${productName} foi excluido` });
              void navigate(ROUTES.admin.products);
            },
            onError: (cause) => {
              setConfirmingDelete(false);
              toast({
                variant: 'danger',
                title: 'O produto nao foi excluido',
                description: errorMessage(cause),
              });
            },
          });
        }}
        title="Excluir este produto?"
        description="O cadastro sai do painel e da vitrine, e nao volta. Os pedidos ja fechados continuam mostrando o que foi comprado — eles guardam nome e preco proprios."
        target={productName}
        confirmLabel="Excluir o produto"
        loading={remove.isPending}
      />
    </div>
  );
}

/* ---- Pedacos --------------------------------------------------------------- */

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {note === undefined ? null : <p className={styles.sectionNote}>{note}</p>}
      </div>

      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

/** "Enviando 2 de 5 — asad.jpg". */
function progressLabel(
  progress: { done: number; total: number; current: string } | null,
): string | undefined {
  if (progress === null) {
    return undefined;
  }

  return `Enviando ${String(progress.done + 1)} de ${String(progress.total)} — ${progress.current}`;
}

function FormSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <Skeleton height="4rem" />
      <Skeleton height="16rem" />
      <Skeleton height="12rem" />
      <Skeleton height="14rem" />
    </div>
  );
}
