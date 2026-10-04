import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadAppConfig, loadEnvFile } from '../app-config';

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => {
        loadEnvFile();
        return loadAppConfig();
      },
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
