import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isProd = process.env.NODE_ENV === 'production';

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: unknown[] = [];

    if (exception instanceof AppException) {
      status = exception.getStatus();
      const body = exception.getResponse() as {
        code: string;
        message: string;
        details?: unknown[];
      };
      code = body.code;
      message = body.message;
      details = body.details ?? [];
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const mapped = mapHttpException(exception);
      code = mapped.code;
      message = mapped.message;
      details = mapped.details;
      if (status === HttpStatus.BAD_REQUEST && request.path.includes('/wellness/health-data')) {
        code = 'INVALID_HEALTH_DATA';
        message = 'Health data validation failed';
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `unhandled_error requestId=${request.requestId ?? 'none'} message=${exception.message}`,
      );
      if (!isProd) {
        message = exception.message;
      }
    } else {
      this.logger.error(`unhandled_error requestId=${request.requestId ?? 'none'}`);
    }

    if (status >= 500 && exception instanceof HttpException) {
      this.logger.error(
        `http_error status=${status} code=${code} requestId=${request.requestId ?? 'none'}`,
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message, details },
      requestId: request.requestId ?? null,
    });
  }
}

function mapHttpException(exception: HttpException): {
  code: string;
  message: string;
  details: unknown[];
} {
  const status = exception.getStatus();
  const raw = exception.getResponse();
  let message = exception.message;
  let details: unknown[] = [];

  if (typeof raw === 'string') {
    message = raw;
  } else if (typeof raw === 'object' && raw) {
    const body = raw as Record<string, unknown>;
    if (typeof body.message === 'string') {
      message = body.message;
    } else if (Array.isArray(body.message)) {
      message = 'Request validation failed';
      details = body.message;
    }
  }

  const codeByStatus: Record<number, string> = {
    [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
    [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
    [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
    [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
    [HttpStatus.CONFLICT]: 'CONFLICT',
    [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  };

  return {
    code: codeByStatus[status] ?? 'HTTP_ERROR',
    message,
    details,
  };
}
