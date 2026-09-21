import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { REDACTED_FIELDS } from '../redacted-fields.js';

@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => sanitize(data, new WeakSet())));
  }
}

/**
 * `path` guarda os objetos do caminho da raiz ate aqui, e nao tudo que ja foi
 * visitado.
 *
 * A diferenca aparece quando a mesma referencia e usada duas vezes em lugares
 * diferentes da resposta — a regra de desconto que o produto anuncia no card e
 * repete na escada, por exemplo. Isso nao e ciclo: e o mesmo objeto em dois
 * ramos, e cortar o segundo apagaria um pedaco legitimo da resposta.
 */
function sanitize(value: unknown, path: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (isObjectIdLike(value)) {
    return value.toHexString();
  }

  if (path.has(value)) {
    return undefined;
  }

  path.add(value);

  try {
    return sanitizeObject(value, path);
  } finally {
    // Sai do caminho ao voltar: daqui para a frente, encontrar este objeto de
    // novo e reaproveitamento, nao ciclo.
    path.delete(value);
  }
}

function sanitizeObject(value: object, path: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, path));
  }

  const source = hasToJSON(value) ? value.toJSON() : value;

  if (source === null || typeof source !== 'object') {
    return source;
  }

  if (source !== value && (Array.isArray(source) || isObjectIdLike(source))) {
    return sanitize(source, path);
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(source as Record<string, unknown>)) {
    if (REDACTED_FIELDS.includes(key)) {
      continue;
    }

    const sanitized = sanitize(item, path);

    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }

  return result;
}

function isObjectIdLike(value: object): value is { toHexString(): string } {
  const bsonType = (value as { _bsontype?: unknown })._bsontype;

  return (
    (bsonType === 'ObjectId' || bsonType === 'ObjectID') &&
    typeof (value as { toHexString?: unknown }).toHexString === 'function'
  );
}

function hasToJSON(value: object): value is { toJSON(): unknown } {
  return typeof (value as { toJSON?: unknown }).toJSON === 'function';
}
