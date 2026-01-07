import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { logger } from '../../config/logger.config';
import { ApiResponse } from '../interfaces/api-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const correlationId = request.correlationId || 'unknown';

    const errorResponse: ApiResponse = {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const exceptionData: any = exceptionResponse;
        errorResponse.error = {
          code: exceptionData.error || 'HTTP_EXCEPTION',
          message: exceptionData.message || exception.message,
          details: exceptionData.details || exceptionData.message,
        };
      } else {
        errorResponse.error!.message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      errorResponse.error!.message = exception.message;
      errorResponse.error!.details = exception.stack;
    }

    logger.error('Exception caught', {
      context: 'ExceptionFilter',
      correlationId,
      statusCode: status,
      error: errorResponse.error,
      path: request.url,
      method: request.method,
    });

    response.status(status).json(errorResponse);
  }
}
