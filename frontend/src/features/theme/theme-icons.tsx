import type { SVGProps } from 'react';

/**
 * Os três ícones do tema.
 *
 * Moram aqui, e não em `components/store/icons.tsx` junto dos outros, por
 * causa da direção das dependências: neste projeto `components` importa de
 * `features`, e nunca o contrário. O controle de tema e usado pela loja e
 * pelo painel, então ele não pode morar na pasta de nenhum dos dois — e, se
 * fica em `features`, não alcança o conjunto de ícones de lá.
 *
 * O preço e este involucro de nove linhas repetido. Vale menos que inverter
 * a regra por um desenho.
 *
 * Mesmo traço dos demais: 24 de caixa, 1.5 de espessura, sem preenchimento,
 * `currentColor`. Escolhidos para se distinguirem **pela silhueta** e não
 * pelo detalhe — o botão mostra um por vez e quem olha precisa saber qual e
 * sem parar para examinar. Um retângulo, um círculo com raios e uma foice
 * não se confundem a 20px.
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

/** Sistema: a tela do aparelho, que e quem decide. */
export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16v4" />
    </Icon>
  );
}

/** Claro: o sol. */
export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6 17 7M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
    </Icon>
  );
}

/** Escuro: a lua. */
export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Icon>
  );
}
