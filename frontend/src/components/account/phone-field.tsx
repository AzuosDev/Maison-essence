import { forwardRef } from 'react';
import { Input, type InputProps } from '@/components/ui';
import { maskPhone } from '@/lib/format';

export type PhoneFieldProps = Omit<InputProps, 'onChange' | 'value' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * O campo de telefone da loja.
 *
 * E o campo mais importante da área da conta: **o telefone e a identidade**.
 * E por ele que se entra, e por ele que o servidor liga a conta nova aos
 * pedidos que a pessoa já tinha feito como convidada. Um digito perdido aqui
 * não vira "senha errada" — vira um histórico que nunca aparece.
 *
 * Por isso três coisas:
 *
 * - `inputMode="numeric"` abre o teclado numérico do celular, que e onde
 *   este campo e preenchido quase sempre.
 * - `autoComplete="tel"` deixa o navegador oferecer o número que ele já
 *   conhece, que e mais confiável do que a memória de quem digita.
 * - A máscara e `maskPhone`, que **nunca recusa tecla nem reordena** o que
 *   foi digitado: só acrescenta os parênteses e o hífen no lugar. Campo que
 *   "conserta" o valor no meio da digitação e campo que come o último digito
 *   de quem esta com pressa.
 *
 * A validação não mora aqui: e `normalizePhone`, a mesma função do checkout
 * e a mesma regra do backend. Uma segunda regra escrita neste componente
 * divergiria da outra no dia em que o formato mudasse.
 */
export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(function PhoneField(
  { value, onChange, ...props },
  ref,
) {
  return (
    <Input
      ref={ref}
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      placeholder="(88) 99999-9999"
      value={maskPhone(value)}
      onChange={(event) => {
        onChange(maskPhone(event.target.value));
      }}
      {...props}
    />
  );
});
