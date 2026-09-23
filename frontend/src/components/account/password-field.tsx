import { forwardRef, useState } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/store';
import { Input, type InputProps } from '@/components/ui';
import styles from './password-field.module.css';

export type PasswordFieldProps = Omit<InputProps, 'type' | 'suffix'>;

/**
 * A senha, com o olho que a mostra.
 *
 * Nao e enfeite: esta senha e digitada num teclado de celular, com o dedo,
 * quase sempre no meio de uma compra. Sem o botao, quem erra uma tecla
 * descobre so na recusa do servidor — e tenta de novo as cegas.
 *
 * Tres cuidados que o botao facil de escrever nao tem:
 *
 * - Ele fica **dentro** do campo, alinhado a direita, e nao ao lado: um
 *   botao ao lado empurraria o campo e quebraria a linha no celular.
 * - `tabIndex={-1}` mantem o botao fora da ordem do teclado. Quem preenche
 *   por Tab vai da senha para o botao de enviar, que e para onde quer ir;
 *   quem quer ver a senha esta com o dedo na tela e alcanca o olho.
 * - O rotulo muda com o estado, porque um leitor de tela precisa saber o que
 *   o botao vai fazer, e nao como ele esta desenhado.
 *
 * O campo volta a `password` ao ser desmontado com a tela, entao a senha
 * nunca fica visivel "de um formulario para o outro".
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        suffix={
          <button
            type="button"
            className={styles.toggle}
            onClick={() => {
              setVisible((shown) => !shown);
            }}
            tabIndex={-1}
            aria-label={visible ? 'Esconder a senha' : 'Mostrar a senha'}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        }
        {...props}
      />
    );
  },
);
