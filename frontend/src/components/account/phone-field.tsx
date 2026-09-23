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
 * E o campo mais importante da area da conta: **o telefone e a identidade**.
 * E por ele que se entra, e por ele que o servidor liga a conta nova aos
 * pedidos que a pessoa ja tinha feito como convidada. Um digito perdido aqui
 * nao vira "senha errada" — vira um historico que nunca aparece.
 *
 * Por isso tres coisas:
 *
 * - `inputMode="numeric"` abre o teclado numerico do celular, que e onde
 *   este campo e preenchido quase sempre.
 * - `autoComplete="tel"` deixa o navegador oferecer o numero que ele ja
 *   conhece, que e mais confiavel do que a memoria de quem digita.
 * - A mascara e `maskPhone`, que **nunca recusa tecla nem reordena** o que
 *   foi digitado: so acrescenta os parenteses e o hifen no lugar. Campo que
 *   "conserta" o valor no meio da digitacao e campo que come o ultimo digito
 *   de quem esta com pressa.
 *
 * A validacao nao mora aqui: e `normalizePhone`, a mesma funcao do checkout
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
