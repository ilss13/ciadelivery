import { Module } from '@nestjs/common';
import { NotificationsWorkerModule } from '@ciadelivery/notifications/worker';
import { OutboxWorkerModule } from '@ciadelivery/orders/worker';
import { PlatformModule } from '@ciadelivery/shared';
import { WhatsAppWorkerModule } from '@ciadelivery/whatsapp/worker';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PlatformModule,
    NotificationsWorkerModule,
    WhatsAppWorkerModule,
    OutboxWorkerModule.register(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
