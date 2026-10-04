import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import { runWithTenant } from '../domain/tenant-context';
import { RequestWithTenant } from './public-tenant.guard';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const tenant = request.tenant;
    if (tenant === undefined) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      runWithTenant(tenant, () => {
        subscription = next.handle().subscribe(subscriber);
      });
      return () => subscription?.unsubscribe();
    });
  }
}
