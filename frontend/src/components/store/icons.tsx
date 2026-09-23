import type { SVGProps } from 'react';

/**
 * Os icones da loja, desenhados a mao.
 *
 * Nenhuma biblioteca: sao nove tracos simples, e uma dependencia de icones
 * custaria mais em bytes do que estes arquivos inteiros. Todos seguem o mesmo
 * desenho — traco de 1.5, sem preenchimento, `currentColor` — para que
 * herdem a cor de quem os contem e nao precisem de variante por contexto.
 *
 * `aria-hidden` por padrao: um icone dentro de um botao nao e informacao, e o
 * nome acessivel do botao vem do `aria-label` dele. Quando o icone for o
 * conteudo — um selo, por exemplo —, quem usa passa `aria-hidden={false}` e
 * um `<title>`.
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

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 8h12l-1 12H7L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </Icon>
  );
}

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

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </Icon>
  );
}

/** O unico com preenchimento: e a marca do canal, e o desenho e o dela. */
export function WhatsappIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.41a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.06s.89 2.39 1.01 2.56c.12.16 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17 7h.01" />
    </Icon>
  );
}

export function TiktokIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 4c.5 2.2 1.9 3.5 4 3.7v3c-1.5.1-2.9-.3-4-1.1v5.9a5.5 5.5 0 1 1-5.5-5.5c.3 0 .5 0 .8.05v3.05a2.5 2.5 0 1 0 1.7 2.4V4H15Z" />
    </Icon>
  );
}

/* ---- Selos de confianca ----------------------------------------------- */

export function TruckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </Icon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l7 3v5.5c0 4.3-2.9 8-7 9.5-4.1-1.5-7-5.2-7-9.5V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

/** O passo cumprido, na trilha do checkout. */
export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function CardIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6 15h4" />
    </Icon>
  );
}

/** O pedido fechado, na lista da conta. Caixa amarrada, e nao sacola. */
export function BoxIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
      <path d="m4 7 8 4 8-4M12 11v10" />
    </Icon>
  );
}

/** O endereco salvo. */
export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21c4-4.5 6-7.7 6-10a6 6 0 1 0-12 0c0 2.3 2 5.5 6 10Z" />
      <circle cx="12" cy="11" r="2.25" />
    </Icon>
  );
}

/** Pedir novamente: a seta que volta ao comeco. */
export function RepeatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" />
      <path d="M4 20v-4h4" />
    </Icon>
  );
}

/** Sair da conta. */
export function ExitIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8" />
      <path d="m16 15 4-3-4-3M20 12h-9" />
    </Icon>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 6.5 3 3" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7h14M10 7V5h4v2M7 7l.8 12.1a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L17 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </Icon>
  );
}

/** O endereco padrao. Preenchida quando marcado — ver `filled`. */
export function StarIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon fill={filled ? 'currentColor' : 'none'} {...props}>
      <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4L4.2 9.7l5.4-.8L12 4Z" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 5 7 7-7 7" />
    </Icon>
  );
}

/** Mostrar a senha. O olho aberto. */
export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

/** Esconder a senha. O mesmo olho, riscado. */
export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.6 6.7A9.6 9.6 0 0 1 12 6.5c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.4 8A17 17 0 0 0 2.5 12.5s3.5 6 9.5 6c1.3 0 2.5-.3 3.6-.7" />
      <path d="M9.9 10.4a3 3 0 0 0 4.2 4.2M4 4l16 16" />
    </Icon>
  );
}
