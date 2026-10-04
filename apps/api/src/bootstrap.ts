import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  APP_CONFIG,
  AppConfig,
  HttpExceptionFilter,
  JsonLogger,
  createValidationPipe,
  isOriginAllowed,
  requestIdMiddleware,
} from '@ciadelivery/shared';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import { mountSwagger } from './swagger';

export async function createApiApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  const config = app.get<AppConfig>(APP_CONFIG);
  app.useLogger(new JsonLogger());
  app.flushLogs();
  app.use(helmet());
  app.enableCors({
    credentials: true,
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!isOriginAllowed(origin, config.corsOrigins)) {
        callback(null, false);
        return;
      }

      callback(null, origin ?? true);
    },
  });
  app.use(requestIdMiddleware);
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(createValidationPipe());

  if (config.nodeEnv !== 'production') {
    mountSwagger(app);
  }

  return app;
}
