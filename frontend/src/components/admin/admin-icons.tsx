import type { SVGProps } from 'react';

/**
 * Os icones do painel, desenhados a mao.
 *
 * Mesmo sistema dos icones da loja — grade de 24, traco de 1.5, sem
 * preenchimento, `currentColor` — e um arquivo separado pelo mesmo motivo que
 * `components/admin` existe: o painel nao importa da loja e a loja nao
 * importa do painel. O que os dois compartilham sao os tokens e os
 * primitivos.
 *
 * Nenhuma biblioteca de icones. Trinta desenhos de uma ou duas linhas pesam
 * menos que o `import` de um pacote, e todos saem com o mesmo peso de
 * traco — que e o que faz um menu parecer desenhado por uma pessoa so.
 *
 * `aria-hidden` por padrao: icone dentro de botao nao e informacao, e o nome
 * acessivel vem do texto ou do `aria-label` de quem o contem.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ---- O menu ------------------------------------------------------------- */

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </Icon>
  );
}

/** Produtos: o frasco, que e o que esta loja vende. */
export function BottleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 3h4v3h-4z" />
      <path d="M9 6h6l1.5 3.5V20a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V9.5z" />
      <path d="M7.5 13h9" />
    </Icon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3 8 4.5-8 4.5-8-4.5z" />
      <path d="m4 12 8 4.5 8-4.5" />
      <path d="m4 16.5 8 4.5 8-4.5" />
    </Icon>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </Icon>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3h14v18l-2.3-1.5-2.4 1.5-2.3-1.5L9.7 21l-2.4-1.5L5 21z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </Icon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function CardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h3" />
    </Icon>
  );
}

export function SlidersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 8h14M5 16h14" />
      <circle cx="10" cy="8" r="2" />
      <circle cx="15" cy="16" r="2" />
    </Icon>
  );
}

/* ---- A moldura ---------------------------------------------------------- */

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
      <path d="M9 8.5 5.5 12 9 15.5" />
      <path d="M5.5 12H15" />
    </Icon>
  );
}

/* ---- As acoes ----------------------------------------------------------- */

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

/** As tres bolinhas do menu de acoes da linha. */
export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6.5 7 7.5 20h9l1-13" />
      <path d="M10.5 11v5M13.5 11v5" />
    </Icon>
  );
}

/** A pega de arrastar: seis pontos, como em toda lista reordenavel. */
export function GripIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.5 21 19.5H3z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 6.5A2.5 2.5 0 0 0 12.5 4H6a2 2 0 0 0-2 2v6.5A2.5 2.5 0 0 0 6.5 15" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

/** A volta para a lista. Seta, e nao chevron: chevron aponta, seta leva. */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12H4" />
      <path d="m10 6-6 6 6 6" />
    </Icon>
  );
}

/** Cancelar: o circulo cortado. Nao e a lixeira — pedido nao se apaga. */
export function BanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 4.5-4.5L13 16l2.5-2.5L19 17" />
    </Icon>
  );
}

/** A conversa do WhatsApp, que e para onde o atendimento leva. */
export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 18.5 5.2 15A7.4 7.4 0 0 1 4.5 11.5C4.5 7.4 8 4 12.2 4s7.6 3.4 7.6 7.5-3.4 7.5-7.6 7.5a7.9 7.9 0 0 1-3.4-.8z" />
    </Icon>
  );
}

/* ---- A area de sistema --------------------------------------------------- */

/**
 * Sistema: o escudo.
 *
 * E o unico item do menu que nao e uma coisa da loja, e o desenho diz isso —
 * nenhum outro icone daqui tem essa silhueta.
 */
export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6z" />
    </Icon>
  );
}

/** Usuarios: uma pessoa, e a segunda atras dela. */
export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.6a3.5 3.5 0 0 1 0 5.8" />
      <path d="M18 14.4a6.5 6.5 0 0 1 2.5 5.1" />
    </Icon>
  );
}

/** Auditoria: o relogio que anda para tras. */
export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V9h4.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Icon>
  );
}

/** Saude: o tracado do monitor. */
export function PulseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12.5h4l2-5.5 3 11 2.5-7 1.5 1.5h5" />
    </Icon>
  );
}

/** Resetar senha: a chave. */
export function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9" />
      <path d="M17.5 12v3" />
      <path d="M20.5 12v2" />
    </Icon>
  );
}

/** Encerrar sessoes: o botao de desligar. */
export function PowerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5v8" />
      <path d="M7 6.6a7 7 0 1 0 10 0" />
    </Icon>
  );
}

/** Editar: o lapis. */
export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m15 7 2 2" />
    </Icon>
  );
}

/** Recarregar: a seta que volta ao inicio. */
export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20.5 3.5V8H16" />
    </Icon>
  );
}
