import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import type { Env } from '../../config/env.schema.js';

export interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

type NormalizedError = Pick<ErrorResponseBody, 'statusCode' | 'message' | 'error'>;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const isProduction = this.config.get('NODE_ENV', { infer: true }) === 'production';
    const normalized = this.normalize(exception, isProduction);
    // originalUrl preserva o prefixo global, que o Express remove de req.url.
    const path = request.originalUrl || request.url;

    if (normalized.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${path} -> ${normalized.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      ...normalized,
      timestamp: new Date().toISOString(),
      path,
    };

    response.status(body.statusCode).json(body);
  }

  private normalize(exception: unknown, isProduction: boolean): NormalizedError {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { statusCode, message: payload, error: reasonPhrase(statusCode) };
      }

      const { message, error } = payload as { message?: unknown; error?: unknown };

      return {
        statusCode,
        message: isMessage(message) ? message : exception.message,
        error: typeof error === 'string' ? error : reasonPhrase(statusCode),
      };
    }

    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    return {
      statusCode,
      message:
        !isProduction && exception instanceof Error
          ? exception.message
          : 'Erro interno do servidor',
      error: reasonPhrase(statusCode),
    };
  }
}

function isMessage(value: unknown): value is string | string[] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function reasonPhrase(statusCode: number): string {
  return STATUS_CODES[statusCode] ?? 'Error';
}
