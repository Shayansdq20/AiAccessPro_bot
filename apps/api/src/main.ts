import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableCors({ origin: [config.adminWebUrl, config.storefrontWebUrl], credentials: false });
  app.enableShutdownHooks();
  await app.listen(config.apiPort);
  new Logger('Bootstrap').log(
    `API listening on :${config.apiPort} (bot mode: ${config.telegram.mode})`,
  );
}

void bootstrap();
