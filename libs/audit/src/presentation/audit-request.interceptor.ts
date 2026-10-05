import { Observable, Subscription } from 'rxjs';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { runWithAuditMeta } from '../domain/request-meta';

interface AuditRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

@Injectable()
export class AuditRequestInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const meta = {
      ip: clip(clientIp(request), 64),
      userAgent: clip(header(request, 'user-agent'), 512),
    };
    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      runWithAuditMeta(meta, () => {
        subscription = next.handle().subscribe(subscriber);
      });
      return () => subscription?.unsubscribe();
    });
  }
}

function clientIp(request: AuditRequest): string | null {
  const address = request.ip ?? request.socket?.remoteAddress ?? '';
  return address.length === 0 ? null : address;
}

function header(request: AuditRequest, name: string): string | null {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function clip(value: string | null, max: number): string | null {
  if (value === null || value.length === 0) {
    return null;
  }
  return value.slice(0, max);
}
