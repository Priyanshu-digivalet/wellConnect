import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const started = Date.now();
    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          `${request.method} ${request.path} ${response.statusCode} ${Date.now() - started}ms requestId=${request.requestId ?? 'none'}`,
        );
      }),
    );
  }
}
