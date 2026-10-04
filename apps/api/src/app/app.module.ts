import { Module } from '@nestjs/common';
import { AuthModule } from '@ciadelivery/auth';
import { BrandingModule } from '@ciadelivery/branding';
import { CatalogModule } from '@ciadelivery/catalog';
import { LeadsModule } from '@ciadelivery/leads';
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
    LeadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
