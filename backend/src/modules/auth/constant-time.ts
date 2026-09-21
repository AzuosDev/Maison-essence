/**
 * Roda a operacao e so devolve o resultado depois de `minimumMs`.
 *
 * E um piso, nao um relogio: operacao mais lenta que o piso nao e cortada. O
 * que ele elimina e a diferenca sistematica entre caminhos — responder em 5 ms
 * quando o e-mail nao existe e em 60 ms quando existe entrega a lista de
 * usuarios a quem so cronometra as respostas.
 *
 * O `finally` cobre tambem a falha: o 401 espera o mesmo tanto que o 200.
 */
export async function withMinimumDuration<T>(
  minimumMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();

  try {
    return await operation();
  } finally {
    const remaining = minimumMs - (Date.now() - startedAt);

    if (remaining > 0) {
      await delay(remaining);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
