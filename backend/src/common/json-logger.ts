import type { LoggerService, LogLevel } from '@nestjs/common';
import { redactSensitive } from './log-redaction.js';
import { currentRequestId } from './request-context.js';

/** Uma linha de log, do jeito que ela sai. */
interface LogLine {
  level: LogLevel;
  time: string;
  context?: string;
  requestId?: string;
  message: string;
  stack?: string;
}

/**
 * O log da API: uma linha JSON por evento.
 *
 * O formato colorido e alinhado do Nest serve a quem le o terminal; em
 * producao quem le e uma ferramenta de busca. Na Vercel, cada linha de stdout
 * vira um evento, e um evento estruturado pode ser filtrado por `requestId`,
 * `level` e `context` — enquanto texto formatado so pode ser procurado por
 * pedaco de frase. A diferenca aparece no dia do incidente.
 *
 * O `requestId` vem do contexto assincrono (`request-context.ts`), e nao de um
 * parametro: qualquer `Logger` do projeto, em qualquer profundidade, sai com
 * ele sem que nenhuma assinatura mude. E o que permite ler a historia inteira
 * de uma requisicao — guard, servico, erro — juntando pelo mesmo valor.
 *
 * Toda linha passa por `redactSensitive` antes de sair. E a ultima rede: o
 * lugar certo de esconder um segredo e antes de escreve-lo, mas o log e
 * escrito em dezenas de pontos e a regra vale para todos.
 */
export class JsonLogger implements LoggerService {
  constructor(private levels: readonly LogLevel[]) {}

  log(message: unknown, ...params: unknown[]): void {
    this.write('log', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write('error', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.write('verbose', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.write('fatal', message, params);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.levels = levels;
  }

  /**
   * O Nest chama `error(mensagem, pilha, contexto)` e `log(mensagem,
   * contexto)`: o contexto e sempre o ultimo, e o penultimo so existe no erro.
   * Em vez de adivinhar pelo conteudo, a contagem de argumentos resolve.
   */
  private write(level: LogLevel, message: unknown, params: unknown[]): void {
    if (!this.levels.includes(level)) {
      return;
    }

    const context = params.length > 0 ? asText(params[params.length - 1]) : undefined;
    const stack = params.length > 1 ? asText(params[0]) : undefined;
    const line: LogLine = {
      level,
      time: new Date().toISOString(),
      ...(context ? { context } : {}),
      ...(currentRequestId() ? { requestId: currentRequestId() } : {}),
      message: asText(message),
      ...(stack ? { stack } : {}),
    };

    const serialized = `${redactSensitive(JSON.stringify(line))}\n`;

    if (level === 'error' || level === 'fatal') {
      process.stderr.write(serialized);

      return;
    }

    process.stdout.write(serialized);
  }
}

/**
 * Niveis por ambiente.
 *
 * `debug` e `verbose` ficam de fora em producao: sao caros em volume e o que
 * eles contam so interessa a quem esta desenvolvendo.
 *
 * Em teste sobra so o que e problema. Nao e economia de bytes: a linha sai
 * por `process.stdout` direto, que o vitest nao intercepta, entao cada uma
 * atravessa o terminal de verdade e atrasa a suite inteira. O teste que
 * precisa inspecionar o log liga os niveis que quer, no seu proprio logger.
 */
export function logLevelsFor(nodeEnv: string): LogLevel[] {
  if (nodeEnv === 'production') {
    return ['fatal', 'error', 'warn', 'log'];
  }

  return nodeEnv === 'test'
    ? ['fatal', 'error', 'warn']
    : ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'];
}

function asText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.stack ?? value.message;
  }

  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // Objeto com referencia circular: o que importa e a linha sair.
    return String(value);
  }
}
