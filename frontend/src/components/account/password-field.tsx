import { forwardRef, useState } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/store';
import { Input, type InputProps } from '@/components/ui';
import styles from './password-field.module.css';

export type PasswordFieldProps = Omit<InputProps, 'type' | 'suffix'>;

/**
 * A senha, com o olho que a mostra.
 *
 * Não e enfeite: esta senha e digitada num teclado de celular, com o dedo,
 * quase sempre no meio de uma compra. Sem o botão, quem erra uma tecla
 * descobre só na recusa do servidor — e tenta de novo as cegas.
 *
 * Três cuidados que o botão fácil de escrever não tem:
 *
 * - Ele fica **dentro** do campo, alinhado a direita, e não ao lado: um
 *   botão ao lado empurraria o campo e quebraria a linha no celular.
 * - `tabIndex={-1}` mantem o botão fora da ordem do teclado. Quem preenche
 *   por Tab vai da senha para o botão de enviar, que e para onde quer ir;
 *   quem quer ver a senha esta com o dedo na tela e alcança o olho.
 * - O rótulo muda com o estado, porque um leitor de tela precisa saber o que
 *   o botão vai fazer, e não como ele esta desenhado.
 *
 * O campo volta a `password` ao ser desmontado com a tela, então a senha
 * nunca fica visível "de um formulário para o outro".
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
