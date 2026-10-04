import { JsonLogger } from '@ciadelivery/shared';
import { RequestActor } from '@ciadelivery/users';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

interface AdminRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
  actor?: RequestActor;
}

@Injectable()
export class AdminAccessLogInterceptor implements NestInterceptor {
  private readonly logger = new JsonLogger();

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const path = requestPath(request);
    const actor = request.actor;
    if (isAdminPath(path) && actor !== undefined) {
      this.logger.log({
        message: 'admin access',
        userId: actor.userId,
        tenantId: actor.tenantId,
        action: `${request.method ?? 'GET'} ${path}`,
      });
    }

    return next.handle();
  }
}

function isAdminPath(path: string): boolean {
  return path === '/api/v1/admin' || path.startsWith('/api/v1/admin/');
}

function requestPath(request: AdminRequest): string {
  const raw = request.originalUrl ?? request.url ?? '';
  const path = raw.split('?')[0];
  return path ?? raw;
}
