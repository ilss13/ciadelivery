import { Module } from '@nestjs/common';
import { AuthModule } from '@ciadelivery/auth';
import { BrandingModule } from '@ciadelivery/branding';
import { LeadsModule } from '@ciadelivery/leads';
import { PlatformModule } from '@ciadelivery/shared';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PlatformTenantsModule } from './platform-tenants.module';

@Module({
  imports: [
    PlatformModule,
    PlatformTenantsModule,
    AuthModule,
    BrandingModule,
    LeadsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
