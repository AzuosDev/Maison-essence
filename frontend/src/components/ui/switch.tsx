import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cx } from '@/lib/cx';
import styles from './switch.module.css';

/**
 * O interruptor: liga e desliga, na hora.
 *
 * ## Por que não e um Checkbox
 *
 * A caixa de marcar responde "isto vai valer quando eu salvar". O
 * interruptor responde "isto **já** vale". São promessas diferentes, e usar o
 * desenho errado faz a dona apertar e depois procurar o botão de salvar que
 * não existe — ou pior, apertar e ir embora achando que não salvou.
 *
 * Por isso este componente não pertence a um formulário. Ele pertence a uma
 * linha de tabela, ao lado do produto que acabou de ser publicado.
 *
 * ## `role="switch"`, e não `checkbox`
 *
 * Um `<input type="checkbox">` com `role="switch"` continua sendo um input
 * nativo — recebe foco, responde ao Espaço, entra no formulário — e passa a
 * ser anunciado como "ligado/desligado" em vez de "marcado/desmarcado". E a
 * diferença entre o leitor de tela descrever o que a pessoa vê e descrever
 * outro controle.
 *
 * ## O rótulo nunca some
 *
 * `label` e obrigatório. Ele pode ficar só para o leitor de tela com
 * `hideLabel` — numa tabela, onde a coluna já diz "Status" e repetir o nome
 * do produto em cada linha seria ruído visual —, mas um interruptor sem nome
 * acessível e um controle que ninguém que não enxerga consegue usar.
 */
export type SwitchProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'type' | 'className' | 'children'
> & {
  /** "Publicado", ou "Publicar Asad 100ml" quando o rótulo esta escondido. */
  label: string;
  /** Mantem o rótulo só para o leitor de tela: a coluna da tabela já o diz. */
  hideLabel?: boolean;
  className?: string | undefined;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, hideLabel = false, className, disabled, checked, ...props },
  ref,
) {
  return (
    <label className={cx(styles.wrapper, disabled && styles.disabled, className)}>
      <input
        ref={ref}
        type="checkbox"
        /*
          O detector pede `aria-checked` ao lado de `role="switch"`, e aqui
          ele estaria errado: em ARIA in HTML, um `<input type="checkbox">`
          com este papel já expoe o estado marcado como `aria-checked`, e
          escrever o atributo a mão cria uma segunda fonte da mesma verdade —
          que e como um interruptor acaba anunciando "desligado" depois de
          ligado.
        */
        // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
        role="switch"
        checked={checked}
        disabled={disabled}
        className={styles.input}
        {...props}
      />

      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>

      <span className={hideLabel ? 'visually-hidden' : styles.label}>{label}</span>
    </label>
  );
});
