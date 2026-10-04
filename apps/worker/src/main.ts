import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '@ciadelivery/shared';
import { createWorkerApplication } from './bootstrap';

async function bootstrap(): Promise<void> {
  const app = await createWorkerApplication();
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.workerPort, '0.0.0.0');
  Logger.log(
    `Application is running on: http://localhost:${config.workerPort}/`,
  );
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
