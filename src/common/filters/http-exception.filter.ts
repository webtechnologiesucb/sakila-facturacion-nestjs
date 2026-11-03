import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'Internal Server Error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const payload = body as Record<string, any>;
        message = payload.message || exception.message;
        error = payload.error || 'Error';
        details = payload.details;
      }
    } else if (exception instanceof Error) {
      // No se exponen stack traces ni detalles internos al cliente.
      this.logger.error(`${exception.name}: ${exception.message}`);
    }

    this.logger.warn(`HTTP ${status} ${request.method} ${request.url}`);
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
      message,
      error,
      ...(details ? { details } : {}),
      requestId: (request as any).requestId,
    });
  }
}
