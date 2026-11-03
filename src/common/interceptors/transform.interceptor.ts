import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const requestId = request.headers['x-request-id'] || randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      map((data) => {
        if (data && data.__raw === true) {
          return data.body;
        }
        return {
          statusCode: response.statusCode,
          timestamp: new Date().toISOString(),
          requestId,
          path: request.originalUrl || request.url,
          data,
        };
      }),
    );
  }
}
