import { useEffect, useState } from 'react';

/**
 * O valor depois que a digitacao para.
 *
 * Existe para a busca: sem ele, "perfume" dispara sete consultas ao servidor,
 * seis das quais chegam com resultado ja obsoleto. Com 300ms, quem digita
 * corrido gera uma consulta so — e quem digita devagar continua vendo a lista
 * acompanhar.
 *
 * O atraso e cancelado a cada tecla, entao o contador so chega ao fim quando
 * a pessoa realmente parou.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return settled;
}
