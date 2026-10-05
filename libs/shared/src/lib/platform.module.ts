import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';

@Module({
  imports: [AppConfigModule, GeocodingModule, DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [AppConfigModule],
})
export class PlatformModule {}
