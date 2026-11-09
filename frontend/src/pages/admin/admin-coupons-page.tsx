import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { ArrowLeftIcon, ConfirmDialog, CouponCard, PlusIcon } from '@/components/admin';
import { ButtonLink, EmptyState, Skeleton, useToast } from '@/components/ui';
import {
  COUPON_GROUPS,
  COUPON_GROUP_LABELS,
  announcedCouponId,
  canDeleteForever,
  canManageStore,
  couponsSummary,
  groupCoupons,
  useAdminRole,
  useCoupons,
  useDeleteCoupon,
  useUpdateCoupon,
  type AdminCoupon,
} from '@/features/admin';
import { errorMessage } from '@/lib/http';
import { usePageMeta } from '@/lib/use-page-meta';
import styles from './admin-coupons-page.module.css';

/**
 * As campanhas da loja.
 *
 * ## Esta tela e um painel de controle, e não um cadastro
 *
 * Quem abre aqui quase nunca vem criar: vem conferir. "Quantos cupons da Black
 * Friday sobraram?" e a pergunta de um sábado à tarde, feita entre duas
 * mensagens no WhatsApp, e a resposta precisa estar legível sem abrir nada. Por
 * isso a régua de usos vive no cartão e não no formulário, e por isso a lista
 * se relê sozinha a cada trinta segundos e quando a aba volta ao foco — o
 * número muda do outro lado, por conta de quem esta comprando.
 *
 * O cadastro mora em outro endereço, como em produtos: o formulário de um
 * cupom tem onze campos e um seletor de produtos, e abri-lo dentro de um
 * diálogo transformaria a conferência diária no incômodo de uma tela cheia.
 *
 * ## Três grupos, e a razão de cada um
 *
 * **No ar** e o que esta valendo agora — e inclui a esgotada, que esta no ar e
 * sem vaga. Empurrá-la para o fim da página a esconderia no dia em que ela
 * precisa de decisão. **Agendadas** e o que vai virar notícia, na ordem em que
 * vai. **Encerradas** guarda o que terminou e o que foi desligado, do mais
 * recente para o mais antigo, porque e sempre a última campanha que alguém
 * quer reabrir ou copiar.
 *
 * ## O que não esta aqui
 *
 * Busca e paginação. Uma loja tem três campanhas vivas e um punhado de
 * encerradas; filtrar uma lista que cabe na tela e dar trabalho a quem já
 * encontrou o que procurava.
 *
 * ## O que o STAFF vê
 *
 * Nada. Cupom e desconto, desconto e preço, e preço e de quem administra a
 * loja — o backend recusa inclusive a leitura.
 */
export default function AdminCouponsPage() {
  const role = useAdminRole();
  const { toast } = useToast();

  const { data: coupons, isPending, isError, error } = useCoupons();
  const update = useUpdateCoupon();
  const remove = useDeleteCoupon();

  const [deleting, setDeleting] = useState<AdminCoupon | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  usePageMeta({ title: 'Cupons — Painel', description: 'Acesso restrito.' });

  // O verde de "salvo" apaga sozinho, como na tabela de taxas: tempo de ser
  // visto, sem deixar o cartão preso no estado de sucesso.
  useEffect(() => {
    if (savedId === null) {
      return;
    }

    const timer = setTimeout(() => {
      setSavedId(null);
    }, 1200);

    return () => {
      clearTimeout(timer);
    };
  }, [savedId]);

  if (!canManageStore(role)) {
    return (
      <EmptyState
        as="h1"
        title="Esta área e de quem administra a loja"
        description="Cupom e desconto, e desconto e preço. O seu acesso cobre o atendimento: o início do painel e os pedidos — e o pedido já chega com o desconto aplicado."
        actions={
          <Link to={ROUTES.admin.root} className={styles.backLink}>
            <ArrowLeftIcon />
            Voltar para o início
          </Link>
        }
      />
    );
  }

  const groups = groupCoupons(coupons ?? []);
  const announced = announcedCouponId(coupons ?? []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 className={styles.title}>Cupons</h1>

          <p className={styles.count} aria-live="polite">
            {couponsSummary(coupons)}
          </p>
        </div>

        <ButtonLink to={ROUTES.admin.newCoupon} className={styles.add}>
          <PlusIcon />
          Criar cupom
        </ButtonLink>
      </header>

      {isError ? (
        <p className={styles.error} role="alert">
          {errorMessage(error)}
        </p>
      ) : isPending ? (
        <div className={styles.skeleton} aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height="11rem" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState
          as="h2"
          title="Nenhum cupom cadastrado"
          description="Um cupom e um código com desconto e prazo — e, se você quiser, uma campanha anunciada na home com página própria. Comece por um: o código, quantos por cento tira e até quando vale."
          actions={
            <ButtonLink to={ROUTES.admin.newCoupon}>Criar o primeiro cupom</ButtonLink>
          }
        />
      ) : (
        <>
          {/*
            A regra que ninguém descobre olhando, escrita onde ela e lida. A
            diferença entre "limite menos vendidos" e "disponíveis" e o centro
            desta feature: sem ela escrita, um cupom de 50 vira 70 porque o
            que estava em Processando não foi contado.
          */}
          <p className={styles.hint}>
            A conta de cupons vendidos sobe quando você marca o pedido como <strong>Vendido</strong>
            . Pedido ainda aberto já segura um cupom, e por isso o número de disponíveis pode ser
            menor que o limite menos os vendidos.
          </p>

          {COUPON_GROUPS.map((group) =>
            groups[group].length === 0 ? null : (
              <section key={group} className={styles.group} aria-labelledby={`grupo-${group}`}>
                <h2 id={`grupo-${group}`} className={styles.groupTitle}>
                  {COUPON_GROUP_LABELS[group]}
                  <span className={styles.groupCount}>{groups[group].length}</span>
                </h2>

                <div className={styles.cards}>
                  {groups[group].map((coupon) => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
                      announced={coupon.id === announced}
                      saved={coupon.id === savedId}
                      busy={update.isPending}
                      onToggleActive={(target) => {
                        update.mutate(
                          { id: target.id, input: { isActive: !target.isActive } },
                          {
                            onSuccess: (saved) => {
                              setSavedId(saved.id);
                              toast({
                                variant: 'success',
                                title: saved.isActive
                                  ? `${saved.code} voltou a valer`
                                  : `${saved.code} foi desligado`,
                                description: saved.isActive
                                  ? 'O código já funciona no fechamento, dentro do prazo cadastrado.'
                                  : 'O código para de valer agora. O prazo e a conta de usos ficam guardados.',
                              });
                            },
                            onError: (cause) => {
                              toast({
                                variant: 'danger',
                                title: `${target.code} continua como estava`,
                                description: errorMessage(cause),
                              });
                            },
                          },
                        );
                      }}
                      {...(canDeleteForever(role) ? { onDelete: setDeleting } : {})}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
        }}
        onConfirm={() => {
          if (deleting === null) {
            return;
          }

          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast({ variant: 'success', title: `${deleting.code} foi excluído` });
              setDeleting(null);
            },
            onError: (cause) => {
              setDeleting(null);
              toast({
                variant: 'danger',
                title: 'O cupom não foi excluído',
                description: errorMessage(cause),
              });
            },
          });
        }}
        title="Excluir este cupom?"
        description="O histórico vai junto: quantas vendas a campanha fez e quantos cupons ela gastou deixam de existir, e esta e a única tela onde essa conta estava escrita. Se a ideia e encerrar, desligue a campanha — o código para de valer na hora e a conta fica guardada. Os pedidos já fechados não mudam: eles guardam código, nome e desconto em copia própria."
        target={deleting === null ? '' : deleting.code}
        confirmLabel="Excluir o cupom"
        loading={remove.isPending}
      />
    </div>
  );
}
