import { forwardRef } from 'react';
import { Input, type InputProps } from '@/components/ui';
import { maskIdentifier } from '@/features/account';

export type IdentifierFieldProps = Omit<InputProps, 'onChange' | 'value' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * O campo único da entrada: celular **ou** e-mail.
 *
 * O cliente se identifica pelo celular dos pedidos; quem trabalha na loja,
 * pelo e-mail do acesso. Os dois cabem aqui porque um seletor "sou cliente /
 * sou da loja" anunciaria a toda visita que há um painel atrás desta tela.
 * Quem decide o destino e `resolveIdentifier`, pelo formato do que foi
 * escrito, sem perguntar nada ao servidor.
 *
 * ## O teclado e o completo, e essa e a escolha difícil
 *
 * O `PhoneField` da loja abre o teclado numérico, e ele e melhor para o
 * cliente — que e a maioria esmagadora de quem chega aqui. Mas `inputMode`
 * numérico, no iPhone, e um teclado **sem letras**: a dona abriria este
 * campo no celular dela e não teria como escrever a primeira letra do
 * próprio e-mail. Uma porta que se pode abrir com um toque a mais vale mais
 * que uma que não abre.
 *
 * O `autoComplete="username"` e o que devolve a maior parte desse custo: no
 * segundo acesso o navegador preenche os dois campos e ninguém digita nada.
 *
 * ## O exemplo saiu do placeholder, e a regra ficou
 *
 * Havia `(88) 99999-9999` ali, herdado do campo de telefone, e ele desmentia
 * o rótulo logo acima: um exemplo preenchido pesa mais que o nome do campo,
 * e quem ia digitar um e-mail via a tela pedindo um número. Um exemplo dos
 * dois formatos resolveria a dúvida e criaria outra — `(88) 99999-9999 ou
 * nome@email.com` não cabe na largura do cartão num celular de 360px, e
 * placeholder cortado no meio e pior que placeholder nenhum.
 *
 * Fica a regra, sem exemplo: os dois formatos nomeados, e o DDD dito — que e
 * a única parte do telefone que alguém esquece.
 *
 * A máscara continua agindo enquanto o que há no campo for só número, e sai
 * de cena — sem comer caractere — na primeira letra. A regra inteira esta em
 * `maskIdentifier`, com os casos em `sign-in-identifier.spec.ts`.
 */
export const IdentifierField = forwardRef<HTMLInputElement, IdentifierFieldProps>(
  function IdentifierField({ value, onChange, ...props }, ref) {
    return (
      <Input
        ref={ref}
        type="text"
        autoComplete="username"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Celular com DDD ou e-mail"
        value={value}
        onChange={(event) => {
          onChange(maskIdentifier(event.target.value));
        }}
        {...props}
      />
    );
  },
);
