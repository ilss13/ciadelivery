import { Module } from '@nestjs/common';
import { AuditModule } from '@ciadelivery/audit';
import { AuthModule } from '@ciadelivery/auth';
import { BrandingModule } from '@ciadelivery/branding';
import { CatalogModule } from '@ciadelivery/catalog';
import { CustomersModule } from '@ciadelivery/customers';
import { LeadsModule } from '@ciadelivery/leads';
import { NotificationsModule } from '@ciadelivery/notifications';
import { OnboardingModule } from '@ciadelivery/onboarding';
import { OrdersModule } from '@ciadelivery/orders';
import { ReportsModule } from '@ciadelivery/reports';
import { PlatformModule, StorageModule } from '@ciadelivery/shared';
import { WhatsAppModule } from '@ciadelivery/whatsapp';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlatformTenantsModule } from './platform-tenants.module';

@Module({
  imports: [
    PlatformModule,
    StorageModule,
    PlatformTenantsModule,
    AuditModule,
    AuthModule,
    BrandingModule,
    CatalogModule,
    CustomersModule,
    OrdersModule,
    ReportsModule,
    NotificationsModule,
    OnboardingModule,
    LeadsModule,
    WhatsAppModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
