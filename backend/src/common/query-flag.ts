import { Transform } from 'class-transformer';

/**
 * Bandeira vinda da query string.
 *
 * `?inStock` sem valor, `?inStock=true` e `?inStock=1` querem dizer a mesma
 * coisa — o link vem do filtro da vitrine ou do painel, e cada biblioteca de
 * front monta de um jeito. Sem isto, `@IsBoolean` reprovaria o texto
 * `"true"`, que e o único tipo que uma query string sabe carregar.
 *
 * O que não for reconhecido passa intacto de propósito: quem recusa e o
 * `@IsBoolean` do campo, com a mensagem dele. Um `false` devolvido aqui para
 * qualquer lixo transformaria `?readyToShip=talvez` num filtro silencioso.
 */
export function queryFlagOf(value: unknown): unknown {
  if (value === '' || value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return value;
}

/** O decorator que aplica `queryFlagOf` num campo de DTO. */
export const QueryFlag = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => queryFlagOf(value));
