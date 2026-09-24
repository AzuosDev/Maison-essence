/**
 * O contador de chamadas, visto por quem o consulta.
 *
 * Classe abstrata, e não interface, porque em runtime ela precisa existir:
 * e ela o token que o Nest usa para injetar o armazenamento no guard e no
 * `RateLimitService`. Interface some na compilação e não serve de token.
 *
 * Esta forma nasceu do `ThrottlerStorage` do `@nestjs/throttler`, que saiu do
 * projeto: o pacote e CommonJS e o Nest 12 e ESM puro, e o runtime da Vercel
 * recusa o `require()` de um pelo outro (`ERR_REQUIRE_ESM`). O que o pacote
 * fazia por nós — ler os metadados da rota, contar e escrever os cabeçalhos —
 * cabe no guard deste módulo, e o armazenamento já era nosso.
 */
export abstract class RateLimitStorage {
  /**
   * Conta mais uma chamada desta chave e diz como a janela ficou.
   *
   * `ttl` em milissegundos, `timeToExpire` em segundos: a janela e configurada
   * na unidade que o resto do Nest usa e respondida na unidade que vai para o
   * `Retry-After`.
   */
  abstract increment(key: string, ttl: number, limit: number): Promise<RateLimitRecord>;
}

/** Como a janela ficou depois da chamada que acabou de ser contada. */
export interface RateLimitRecord {
  /** Chamadas contadas na janela, incluindo esta. */
  totalHits: number;
  /** Segundos que faltam para a janela virar. Nunca zero. */
  timeToExpire: number;
  /** `true` quando esta chamada passou do teto. */
  isBlocked: boolean;
  /** Segundos de espera a anunciar, ou zero quando não há bloqueio. */
  timeToBlockExpire: number;
}
