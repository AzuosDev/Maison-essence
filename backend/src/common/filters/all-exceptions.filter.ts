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
import { Error as MongooseError } from 'mongoose';
import type { Env } from '../../config/env.schema.js';
import { errorResponseBody, reasonPhrase } from '../error-response.js';
import type { ErrorResponseBody } from '../error-response.js';

type NormalizedError = Pick<
  ErrorResponseBody,
  'statusCode' | 'message' | 'error' | 'details'
>;

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

    const body = errorResponseBody(normalized, path);

    response.status(body.statusCode).json(body);
  }

  private normalize(exception: unknown, isProduction: boolean): NormalizedError {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { statusCode, message: payload, error: reasonPhrase(statusCode) };
      }

      const { message, error, details } = payload as {
        message?: unknown;
        error?: unknown;
        details?: unknown;
      };

      return {
        statusCode,
        message: isMessage(message) ? message : exception.message,
        error: typeof error === 'string' ? error : reasonPhrase(statusCode),
        ...(isDetails(details) ? { details } : {}),
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      const statusCode = HttpStatus.UNPROCESSABLE_ENTITY;

      return {
        statusCode,
        message: validationMessages(exception),
        error: reasonPhrase(statusCode),
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

/**
 * Regra de dominio recusada pelo schema vira 422, e nao 500.
 *
 * Nem toda regra cabe no DTO: "o produto precisa de ao menos uma variante" e
 * "o preco de comparacao precisa ser maior que o de venda" valem tambem para
 * o seed e para um script de manutencao, e por isso moram no schema. As
 * mensagens ja estao em portugues la — aqui elas so ganham o status certo e
 * o caminho do campo, que diz qual variante da lista reprovou.
 */
function validationMessages(exception: MongooseError.ValidationError): string[] {
  return Object.entries(exception.errors).map(([path, error]) => `${path}: ${error.message}`);
}

function isDetails(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMessage(value: unknown): value is string | string[] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}
