import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { createOpenApiDocument } from './swagger';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  await app.init();
  const document = createOpenApiDocument(app);
  writeFileSync(
    resolve(process.cwd(), 'openapi.json'),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  await app.close();
}

void generate().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
