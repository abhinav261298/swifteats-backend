import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { logger } from '../../config/logger.config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const correlationId = request.headers['x-correlation-id'] || uuidv4();

    // Attach correlation ID to request for use in services
    request.correlationId = correlationId;

    const now = Date.now();

    logger.info('Incoming request', {
      context: 'HTTP',
      correlationId,
      method,
      url,
      body: this.sanitizeBody(body),
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          logger.info('Request completed', {
            context: 'HTTP',
            correlationId,
            method,
            url,
            duration: `${duration}ms`,
          });
        },
        error: (error) => {
          const duration = Date.now() - now;
          logger.error('Request failed', {
            context: 'HTTP',
            correlationId,
            method,
            url,
            duration: `${duration}ms`,
            error: error.message,
            stack: error.stack,
          });
        },
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret'];

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }
}
