import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  HttpExceptionFilter,
  JsonLogger,
  createValidationPipe,
  requestIdMiddleware,
} from '@ciadelivery/shared';
import { AppModule } from './app/app.module';

export async function createWorkerApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(new JsonLogger());
  app.flushLogs();
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(createValidationPipe());
  return app;
}
