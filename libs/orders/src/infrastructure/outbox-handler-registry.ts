import { Global, Injectable, Module } from '@nestjs/common';
import { OutboxHandler } from '../domain/outbox';

@Injectable()
export class OutboxHandlerRegistry {
  private readonly registered: OutboxHandler[] = [];

  add(handler: OutboxHandler): void {
    if (this.registered.some((item) => item.name === handler.name)) {
      return;
    }
    this.registered.push(handler);
  }

  handlers(): readonly OutboxHandler[] {
    return this.registered;
  }
}

@Global()
@Module({
  providers: [OutboxHandlerRegistry],
  exports: [OutboxHandlerRegistry],
})
export class OutboxHandlerRegistryModule {}
