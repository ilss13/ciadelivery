import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG, AppConfig } from '../app-config';
import { AppConfigModule } from '../config/app-config.module';
import { DatabaseReady } from './database-ready';
import { createDataSourceOptions } from './data-source-options';
import 'mysql2';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        ...createDataSourceOptions(config),
        autoLoadEntities: true,
        manualInitialization: true,
      }),
    }),
  ],
  providers: [DatabaseReady],
  exports: [DatabaseReady],
})
export class DatabaseModule {}
