import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../app-config';
import { LocalStorage } from './local-storage';
import { MediaController } from './media.controller';
import { S3Storage } from './s3-storage';
import { STORAGE, StorageProvider } from './storage-provider';

@Global()
@Module({
  controllers: [MediaController],
  providers: [
    {
      provide: STORAGE,
      useFactory: (config: AppConfig): StorageProvider => createStorage(config),
      inject: [APP_CONFIG],
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}

export function createStorage(config: AppConfig): StorageProvider {
  if (config.storageDriver === 's3') {
    return new S3Storage({
      endpoint: config.s3Endpoint,
      bucket: config.s3Bucket,
      region: config.s3Region,
      accessKey: config.s3AccessKey,
      secretKey: config.s3SecretKey,
    });
  }

  return new LocalStorage(config.storageLocalDir, config.storagePublicBaseUrl);
}
