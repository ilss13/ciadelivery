import { Module } from '@nestjs/common';
import { AuthModule } from '@ciadelivery/auth';
import { BrandingModule } from '@ciadelivery/branding';
import { CatalogModule } from '@ciadelivery/catalog';
import { CustomersModule } from '@ciadelivery/customers';
import { LeadsModule } from '@ciadelivery/leads';
import { OrdersModule } from '@ciadelivery/orders';
import { PlatformModule, StorageModule } from '@ciadelivery/shared';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlatformTenantsModule } from './platform-tenants.module';

@Module({
  imports: [
    PlatformModule,
    StorageModule,
    PlatformTenantsModule,
    AuthModule,
    BrandingModule,
    CatalogModule,
    CustomersModule,
    OrdersModule,
    LeadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
