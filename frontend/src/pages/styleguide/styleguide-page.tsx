import { useState, type ReactNode } from 'react';
import {
  Accordion,
  AccordionItem,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Chip,
  Container,
  Drawer,
  EmptyState,
  Input,
  Modal,
  Pagination,
  Radio,
  RadioGroup,
  Select,
  Skeleton,
  SkeletonText,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
  Toast,
  useToast,
} from '@/components/ui';
import { formatCents } from '@/lib/format';
import styles from './styleguide.module.css';

/**
 * O styleguide.
 *
 * E a bancada de revisao do design system: todo primitivo, em todos os
 * estados, na mesma tela. Serve para tres coisas que uma pagina da loja nao
 * serve — comparar variantes lado a lado, conferir se algum componente
 * escapou dos tokens, e testar teclado e leitor de tela sem precisar montar
 * um fluxo de compra.
 *
 * So existe em desenvolvimento. A rota e o `import()` ficam dentro de um
 * `import.meta.env.DEV` em `app/router.tsx`, que o Vite substitui por
 * `false` no build — e o bundle de producao nem chega a conter este arquivo.
 */

const SECTIONS = [
  ['tokens', 'Tokens'],
  ['tipografia', 'Tipografia'],
  ['button', 'Button'],
  ['formulario', 'Formulario'],
  ['badge-chip', 'Badge e Chip'],
  ['card', 'Card'],
  ['dialogos', 'Modal e Drawer'],
  ['feedback', 'Skeleton, Spinner e Toast'],
  ['navegacao', 'Tabs e Accordion'],
  ['caminho', 'Breadcrumb e Pagination'],
  ['vazio', 'EmptyState'],
] as const;

const COLORS = [
  ['--ink', 'Header, botao primario, texto forte'],
  ['--ink-soft', 'Texto de corpo'],
  ['--muted', 'Texto secundario, placeholder'],
  ['--cream', 'Fundo geral da loja'],
  ['--sand', 'Secoes alternadas, chips'],
  ['--surface', 'Cards, inputs, paineis'],
  ['--gold', 'Filete do logo, detalhes, hover'],
  ['--gold-deep', 'Dourado sobre creme, foco'],
  ['--line', 'Bordas de 1px'],
  ['--success', 'Pronta entrega, confirmacao'],
  ['--danger', 'Esgotado, erros'],
  ['--admin-bg', 'Fundo do painel'],
] as const;

const TYPE_SCALE = [
  ['--text-48', '3rem'],
  ['--text-36', '2.25rem'],
  ['--text-28', '1.75rem'],
  ['--text-22', '1.375rem'],
  ['--text-18', '1.125rem'],
  ['--text-16', '1rem'],
  ['--text-14', '0.875rem'],
  ['--text-12', '0.75rem'],
] as const;

const SPACES = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

const CIDADES = [
  { value: 'juazeiro', label: 'Juazeiro do Norte' },
  { value: 'crato', label: 'Crato' },
  { value: 'barbalha', label: 'Barbalha' },
  { value: 'missao', label: 'Missao Velha', disabled: true },
];

export default function StyleguidePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Container>
          <h1 className={styles.title}>Design system</h1>
          <p className={styles.subtitle}>
            Os primitivos da Maison Essence, em todos os estados. Visivel so em desenvolvimento.
          </p>

          <nav className={styles.toc} aria-label="Secoes">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} className={styles.tocLink}>
                {label}
              </a>
            ))}
          </nav>
        </Container>
      </header>

      <Container as="main" className={styles.main}>
        <TokensSection />
        <TypographySection />
        <ButtonSection />
        <FormSection />
        <BadgeChipSection />
        <CardSection />
        <DialogSection />
        <FeedbackSection />
        <NavigationSection />
        <PathSection />
        <EmptySection />
      </Container>
    </div>
  );
}

/* ---------------------------------------------------------------- moldura */

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {note ? <p className={styles.sectionNote}>{note}</p> : null}
      {children}
    </section>
  );
}

function Sample({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={styles.sample} style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <p className={styles.sampleLabel}>{label}</p>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- tokens */

function TokensSection() {
  return (
    <Section
      id="tokens"
      title="Tokens"
      note="Toda cor da loja esta nesta lista. Nenhum componente escreve hexadecimal: o que aparece aqui e o que existe."
    >
      <div className={styles.swatches}>
        {COLORS.map(([token, use]) => (
          <div key={token} className={styles.swatch}>
            <div className={styles.chipColor} style={{ backgroundColor: `var(${token})` }} />
            <span className={styles.swatchName}>{token}</span>
            <span className={styles.swatchUse}>{use}</span>
          </div>
        ))}
      </div>

      <div className={styles.samples}>
        <Sample label="Escala de espaco (4 a 96)">
          <div className={styles.spaces}>
            {SPACES.map((space) => (
              <div key={space} className={styles.space}>
                <div className={styles.spaceBar} style={{ width: `var(--space-${space})` }} />
                <span className={styles.swatchUse}>{space}</span>
              </div>
            ))}
          </div>
        </Sample>

        <Sample label="Raio, sombra e foco">
          <div className={styles.row}>
            <div
              style={{
                width: '4rem',
                height: '3rem',
                backgroundColor: 'var(--surface)',
                border: 'var(--border)',
                borderRadius: 'var(--radius-chip)',
              }}
            />
            <div
              style={{
                width: '4rem',
                height: '3rem',
                backgroundColor: 'var(--surface)',
                border: 'var(--border)',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow)',
              }}
            />
            <div
              style={{
                width: '4rem',
                height: '3rem',
                backgroundColor: 'var(--surface)',
                border: 'var(--border)',
                borderRadius: 'var(--radius-modal)',
                boxShadow: 'var(--shadow)',
              }}
            />
          </div>
          <p className={styles.sectionNote}>4px chip · 12px card · 16px modal</p>
        </Sample>

        <Sample label="Anel de foco sobre fundo escuro" wide>
          <div className={`${styles.dark} on-dark`}>
            <p className={styles.darkLabel}>
              Navegue por Tab: sobre o preto o anel troca para --gold
            </p>
            <div className={styles.row}>
              <Button>Primario</Button>
              <Button variant="ghost" style={{ color: 'var(--sand)' }}>
                Fantasma
              </Button>
            </div>
          </div>
        </Sample>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- tipografia */

function TypographySection() {
  return (
    <Section
      id="tipografia"
      title="Tipografia"
      note="Cormorant Garamond nos titulos, Jost no corpo. Preco sempre em Jost 600 tabular."
    >
      <div className={styles.scale}>
        {TYPE_SCALE.map(([token, size]) => (
          <div key={token} className={styles.scaleRow}>
            <span className={styles.scaleName}>{token}</span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: `var(${token})`,
                lineHeight: 'var(--leading-tight)',
                color: 'var(--ink)',
              }}
            >
              Maison Essence
            </span>
            <span className={styles.swatchUse}>{size}</span>
          </div>
        ))}
      </div>

      <div className={styles.samples}>
        <Sample label="Corpo em Jost">
          <p style={{ lineHeight: 'var(--leading-body)' }}>
            Perfume amadeirado com notas de baunilha e ambar. O texto de corpo usa Jost 400 com
            entrelinha de 1.6 — a medida que sustenta um paragrafo longo sem cansar.
          </p>
        </Sample>

        <Sample label="Preco, tabular">
          <p
            className="tabular"
            style={{
              fontSize: 'var(--text-22)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--ink)',
            }}
          >
            {formatCents(189_90)}
          </p>
          <p className="tabular" style={{ color: 'var(--muted)' }}>
            {formatCents(11_11)} · {formatCents(1_111_11)}
          </p>
        </Sample>
      </div>
    </Section>
  );
}

/* ----------------------------------------------------------------- button */

function ButtonSection() {
  return (
    <Section
      id="button"
      title="Button"
      note="Quatro variantes. O estado carregando desabilita o botao junto: um envio que aceita o segundo clique cria o segundo pedido."
    >
      <div className={styles.samples}>
        <Sample label="Variantes">
          <div className={styles.row}>
            <Button>Comprar</Button>
            <Button variant="secondary">Ver detalhes</Button>
            <Button variant="ghost">Cancelar</Button>
            <Button variant="danger">Excluir</Button>
          </div>
        </Sample>

        <Sample label="Desabilitado">
          <div className={styles.row}>
            <Button disabled>Comprar</Button>
            <Button variant="secondary" disabled>
              Ver detalhes
            </Button>
            <Button variant="ghost" disabled>
              Cancelar
            </Button>
            <Button variant="danger" disabled>
              Excluir
            </Button>
          </div>
        </Sample>

        <Sample label="Carregando">
          <div className={styles.row}>
            <Button loading>Enviando pedido</Button>
            <Button variant="secondary" loading>
              Salvando
            </Button>
            <Button variant="danger" loading loadingLabel="Excluindo">
              Excluir
            </Button>
          </div>
        </Sample>

        <Sample label="Tamanho pequeno e largura total">
          <div className={styles.row}>
            <Button size="small">Adicionar</Button>
            <Button size="small" variant="secondary">
              Editar
            </Button>
          </div>
          <Button block>Fechar pedido pelo WhatsApp</Button>
        </Sample>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- formulario */

function FormSection() {
  const [cidade, setCidade] = useState('');
  const [pagamento, setPagamento] = useState('PIX');
  const [aceite, setAceite] = useState(false);
  const [observacao, setObservacao] = useState('Entregar depois das 18h.');

  return (
    <Section
      id="formulario"
      title="Formulario"
      note="Rotulo, ajuda e erro sao props do proprio campo: nao ha como usa-los e esquecer o htmlFor ou o aria-describedby."
    >
      <div className={styles.samples}>
        <Sample label="Input">
          <Input label="Nome completo" placeholder="Como no documento" />
          <Input
            label="Celular"
            hint="E por ele que a gente responde no WhatsApp."
            placeholder="(88) 99999-9999"
          />
          <Input label="E-mail" error="Informe um e-mail valido." defaultValue="cliente@" />
          <Input label="Cupom" disabled defaultValue="PRIMEIRACOMPRA" />
        </Sample>

        <Sample label="Input com adorno">
          <Input label="Preco" numeric prefix="R$" defaultValue="189,90" />
          <Input label="Desconto" numeric suffix="%" defaultValue="15" />
          <Input label="Buscar" hideLabel placeholder="Buscar perfume..." type="search" />
        </Sample>

        <Sample label="Select">
          <Select
            label="Cidade de entrega"
            placeholder="Escolha uma cidade"
            options={CIDADES}
            value={cidade}
            onChange={(event) => {
              setCidade(event.target.value);
            }}
            hint="A taxa muda conforme a cidade."
          />
          <Select label="Status" options={CIDADES} error="Escolha uma cidade atendida." />
          <Select label="Bloqueado" options={CIDADES} disabled />
        </Sample>

        <Sample label="Textarea">
          <Textarea
            label="Observacao do pedido"
            value={observacao}
            onChange={(event) => {
              setObservacao(event.target.value);
            }}
            maxLength={200}
            showCount
            hint="Opcional. Aparece na mensagem do WhatsApp."
          />
          <Textarea label="Com erro" error="Escreva ao menos 10 caracteres." defaultValue="oi" />
        </Sample>

        <Sample label="Checkbox">
          <Checkbox
            label="Aceito os termos de troca e devolucao"
            checked={aceite}
            onChange={(event) => {
              setAceite(event.target.checked);
            }}
          />
          <Checkbox label="Quero receber novidades" hint="No maximo um recado por mes." />
          <Checkbox label="Selecionar todos os produtos" indeterminate readOnly checked={false} />
          <Checkbox label="Opcao indisponivel" disabled />
          <Checkbox label="Preciso concordar" error="E preciso aceitar para continuar." />
        </Sample>

        <Sample label="Radio">
          <RadioGroup
            legend="Forma de pagamento"
            name="pagamento"
            value={pagamento}
            onChange={setPagamento}
          >
            <Radio value="PIX" label="PIX" description="5% de desconto, a vista." />
            <Radio value="CARD" label="Cartao" description="Em ate 12x." />
            <Radio value="BOLETO" label="Boleto" disabled description="Indisponivel." />
          </RadioGroup>

          <RadioGroup legend="Entrega" name="entrega" horizontal defaultValue="">
            <Radio value="DELIVERY" label="Entregar" />
            <Radio value="PICKUP" label="Retirar na loja" />
          </RadioGroup>
        </Sample>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------ badge, chip */

function BadgeChipSection() {
  const [categoria, setCategoria] = useState('todos');

  return (
    <Section
      id="badge-chip"
      title="Badge e Chip"
      note="O selo nunca depende so da cor: cada um tem texto, e o texto diz o que a cor sugere."
    >
      <div className={styles.samples}>
        <Sample label="Badge">
          <div className={styles.row}>
            <Badge variant="danger">Esgotado</Badge>
            <Badge variant="ink">-33%</Badge>
            <Badge variant="success">Pronta entrega</Badge>
            <Badge variant="gold">Selecao da casa</Badge>
            <Badge variant="muted" numeric>
              12 pedidos
            </Badge>
          </div>
        </Sample>

        <Sample label="Chip de categoria">
          <div className={styles.row}>
            {[
              ['todos', 'Todos', 48],
              ['masculino', 'Masculino', 24],
              ['feminino', 'Feminino', 18],
              ['velas', 'Velas', 6],
            ].map(([value, label, count]) => (
              <Chip
                key={value as string}
                active={categoria === value}
                count={count as number}
                onClick={() => {
                  setCategoria(value as string);
                }}
              >
                {label as string}
              </Chip>
            ))}
            <Chip disabled>Indisponivel</Chip>
          </div>
        </Sample>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- card */

function CardSection() {
  return (
    <Section
      id="card"
      title="Card"
      note="A mesma superficie serve ao card de produto e ao passo do checkout: titulo de 18px, campos empilhados, botao largo embaixo."
    >
      <div className={styles.samples}>
        <Sample label="Passo do checkout">
          <Card>
            <CardHeader
              title="Dados de contato"
              subtitle="E por aqui que a gente confirma o pedido."
            />
            <CardBody>
              <Input label="Nome" placeholder="Seu nome" />
              <Input label="Celular" placeholder="(88) 99999-9999" />
            </CardBody>
            <CardFooter>
              <Button block>Continuar</Button>
            </CardFooter>
          </Card>
        </Sample>

        <Sample label="Cartao clicavel e cartao simples">
          <Card interactive padded>
            <p style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--ink)' }}>
              Passe o mouse: sobe 2px
            </p>
            <p className={styles.sectionNote}>A borda ganha o dourado no hover.</p>
          </Card>

          <Card padded raised>
            <p style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--ink)' }}>
              Com sombra em repouso
            </p>
            <p className={styles.sectionNote}>A sombra unica do design system.</p>
          </Card>
        </Sample>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- dialogos */

function DialogSection() {
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawerRight, setDrawerRight] = useState(false);
  const [drawerLeft, setDrawerLeft] = useState(false);

  return (
    <Section
      id="dialogos"
      title="Modal e Drawer"
      note="Abra pelo teclado e confira: o foco entra no dialogo, o Tab circula dentro dele, o Escape fecha e o foco volta para o botao que abriu."
    >
      <div className={styles.samples}>
        <Sample label="Modal">
          <div className={styles.row}>
            <Button
              onClick={() => {
                setModal(true);
              }}
            >
              Abrir modal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(true);
              }}
            >
              Confirmar exclusao
            </Button>
          </div>

          <Modal
            open={modal}
            onClose={() => {
              setModal(false);
            }}
            title="Escolha a variante"
            description="Cada tamanho tem preco e estoque proprios."
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setModal(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    setModal(false);
                  }}
                >
                  Adicionar a sacola
                </Button>
              </>
            }
          >
            <div className={styles.stack}>
              <RadioGroup legend="Tamanho" name="tamanho" defaultValue="">
                <Radio value="50" label="50ml" description={formatCents(139_90)} />
                <Radio value="100" label="100ml" description={formatCents(189_90)} />
              </RadioGroup>
              <Input label="Quantidade" type="number" defaultValue={1} numeric />
            </div>
          </Modal>

          <Modal
            open={confirm}
            onClose={() => {
              setConfirm(false);
            }}
            title="Excluir este produto?"
            description="A acao nao pode ser desfeita."
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirm(false);
                  }}
                >
                  Manter
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirm(false);
                  }}
                >
                  Excluir
                </Button>
              </>
            }
          >
            <p>
              O produto sai do catalogo na hora. Os pedidos ja feitos continuam com o nome e o preco
              de quando foram fechados.
            </p>
          </Modal>
        </Sample>

        <Sample label="Drawer">
          <div className={styles.row}>
            <Button
              variant="secondary"
              onClick={() => {
                setDrawerRight(true);
              }}
            >
              Abrir sacola
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDrawerLeft(true);
              }}
            >
              Abrir menu
            </Button>
          </div>

          <Drawer
            open={drawerRight}
            onClose={() => {
              setDrawerRight(false);
            }}
            title="Sua sacola"
            footer={
              <>
                <div className={styles.row} style={{ justifyContent: 'space-between' }}>
                  <span>Subtotal</span>
                  <strong className="tabular">{formatCents(379_80)}</strong>
                </div>
                <Button block>Fechar pedido</Button>
              </>
            }
          >
            <div className={styles.stack}>
              <p>Dois itens na sacola.</p>
              <Input label="Cupom" placeholder="Tem um cupom?" />
            </div>
          </Drawer>

          <Drawer
            open={drawerLeft}
            onClose={() => {
              setDrawerLeft(false);
            }}
            title="Categorias"
            side="left"
          >
            <div className={styles.stack}>
              <Chip>Masculino</Chip>
              <Chip>Feminino</Chip>
              <Chip>Velas</Chip>
            </div>
          </Drawer>
        </Sample>
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------- feedback */

function FeedbackSection() {
  const { toast } = useToast();

  return (
    <Section
      id="feedback"
      title="Skeleton, Spinner e Toast"
      note="O esqueleto e aria-hidden — vinte retangulos cinza nao sao informacao. Quem anuncia o carregamento e o Spinner."
    >
      <div className={styles.samples}>
        <Sample label="Skeleton">
          <Skeleton variant="image" style={{ maxWidth: '10rem' }} />
          <Skeleton variant="title" style={{ maxWidth: '12rem' }} />
          <SkeletonText lines={3} />
          <div className={styles.row}>
            <Skeleton circle width="2.5rem" height="2.5rem" />
            <Skeleton width="8rem" height="1rem" />
          </div>
        </Sample>

        <Sample label="Spinner">
          <div className={styles.row}>
            <Spinner size="small" />
            <Spinner />
            <Spinner size="large" />
          </div>
        </Sample>

        <Sample label="Toast, parados" wide>
          <div className={styles.stack}>
            <Toast title="Produto adicionado a sacola" description="Asad Lattafa, 100ml." />
            <Toast
              variant="success"
              title="Pedido enviado"
              description="Vamos confirmar pelo WhatsApp."
            />
            <Toast
              variant="danger"
              title="Nao foi possivel salvar"
              description="Tente novamente em instantes."
            />
          </div>
        </Sample>

        <Sample label="Toast, de verdade" wide>
          <div className={styles.row}>
            <Button
              size="small"
              onClick={() => {
                toast({
                  title: 'Produto adicionado a sacola',
                  description: 'Asad Lattafa, 100ml.',
                });
              }}
            >
              Disparar aviso
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                toast({ variant: 'success', title: 'Pedido enviado' });
              }}
            >
              Sucesso
            </Button>
            <Button
              size="small"
              variant="danger"
              onClick={() => {
                toast({
                  variant: 'danger',
                  title: 'Nao foi possivel salvar',
                  description: 'Confira sua conexao.',
                });
              }}
            >
              Erro
            </Button>
          </div>
        </Sample>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- navegacao */

function NavigationSection() {
  return (
    <Section
      id="navegacao"
      title="Tabs e Accordion"
      note="Nas abas, as setas trocam e o Tab sai da fila. Na sanfona, as setas movem entre os gatilhos. Home e End vao para as pontas nos dois."
    >
      <div className={`${styles.samples} ${styles.wide}`}>
        <Sample label="Tabs" wide>
          <Tabs defaultValue="descricao">
            <TabList aria-label="Informacoes do produto">
              <Tab value="descricao">Descricao</Tab>
              <Tab value="notas">Notas olfativas</Tab>
              <Tab value="entrega">Entrega</Tab>
              <Tab value="indisponivel" disabled>
                Avaliacoes
              </Tab>
            </TabList>

            <TabPanel value="descricao">
              Perfume amadeirado de longa fixacao, com abertura citrica e fundo de baunilha.
            </TabPanel>
            <TabPanel value="notas">Bergamota, ambar, baunilha e cedro.</TabPanel>
            <TabPanel value="entrega">
              Entrega com taxa fixa nas cidades atendidas, ou retirada na loja.
            </TabPanel>
            <TabPanel value="indisponivel">Ainda nao ha avaliacoes.</TabPanel>
          </Tabs>
        </Sample>

        <Sample label="Accordion" wide>
          <Accordion defaultOpen={['entrega']}>
            <AccordionItem value="entrega" title="Como funciona a entrega?">
              Taxa fixa por cidade atendida, definida no painel. Fora delas, so retirada na loja.
            </AccordionItem>
            <AccordionItem value="pagamento" title="Quais formas de pagamento?">
              PIX, com desconto a vista, e cartao em ate doze vezes. O pagamento e combinado pelo
              WhatsApp — nenhum dado de cartao passa pelo site.
            </AccordionItem>
            <AccordionItem value="troca" title="Posso trocar?">
              Perfume lacrado pode ser trocado em ate sete dias.
            </AccordionItem>
            <AccordionItem value="fechado" title="Item desabilitado" disabled>
              Este item nao abre.
            </AccordionItem>
          </Accordion>
        </Sample>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- caminho */

function PathSection() {
  const [page, setPage] = useState(3);

  return (
    <Section
      id="caminho"
      title="Breadcrumb e Pagination"
      note="No celular os numeros da paginacao somem e ficam as setas com o resumo: doze alvos de toque lado a lado ficam menores que o dedo."
    >
      <div className={styles.samples}>
        <Sample label="Breadcrumb" wide>
          <Breadcrumb
            items={[
              { label: 'Inicio', to: '/' },
              { label: 'Masculino', to: '/' },
              { label: 'Asad Lattafa 100ml' },
            ]}
          />
        </Sample>

        <Sample label="Pagination" wide>
          <Pagination page={page} totalPages={12} onPageChange={setPage} />
          <p className={styles.sectionNote}>Pagina atual: {page}</p>
        </Sample>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ vazio */

function EmptySection() {
  return (
    <Section
      id="vazio"
      title="EmptyState"
      note="Nunca e so 'nada encontrado': diz o que aconteceu e oferece a saida."
    >
      <div className={styles.samples}>
        <Sample label="Busca sem resultado">
          <EmptyState
            icon="◇"
            title="Nenhum perfume encontrado"
            description="Nao achamos nada para essa busca. Talvez em outra categoria?"
            actions={<Button variant="secondary">Ver todos os perfumes</Button>}
          />
        </Sample>

        <Sample label="Sacola vazia, compacto">
          <EmptyState
            compact
            title="Sua sacola esta vazia"
            description="Os perfumes que voce escolher aparecem aqui."
            actions={<Button size="small">Ver a vitrine</Button>}
          />
        </Sample>
      </div>
    </Section>
  );
}
