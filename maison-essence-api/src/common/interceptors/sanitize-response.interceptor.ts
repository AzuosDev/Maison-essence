import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const REDACTED_FIELDS: readonly string[] = ['__v', 'passwordHash'];

@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data: unknown) => sanitize(data, new WeakSet())));
  }
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date || Buffer.isBuffer(value)) {
    return value;
  }

  if (isObjectIdLike(value)) {
    return value.toHexString();
  }

  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  const source = hasToJSON(value) ? value.toJSON() : value;

  if (source === null || typeof source !== 'object') {
    return source;
  }

  if (source !== value && (Array.isArray(source) || isObjectIdLike(source))) {
    return sanitize(source, seen);
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(source as Record<string, unknown>)) {
    if (REDACTED_FIELDS.includes(key)) {
      continue;
    }

    const sanitized = sanitize(item, seen);

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
