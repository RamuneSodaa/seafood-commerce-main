import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-error.filter';

const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3002'
];

function readPort(): number {
  const rawPort = process.env.PORT?.trim();

  if (!rawPort) {
    return 3000;
  }

  if (!/^\d+$/.test(rawPort)) {
    throw new Error('PORT must be a positive integer');
  }

  const port = Number(rawPort);

  if (
    !Number.isSafeInteger(port) ||
    port <= 0 ||
    port > 65535
  ) {
    throw new Error('PORT must be between 1 and 65535');
  }

  return port;
}

function readAllowedOrigins(): string[] {
  const configuredOrigins = process.env.ALLOWED_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return [...new Set(configuredOrigins)];
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ALLOWED_ORIGINS must be configured in production'
    );
  }

  return LOCAL_ALLOWED_ORIGINS;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true
  });

  app.enableCors({
    origin: readAllowedOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-role',
      'x-user-id'
    ]
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();

  await app.listen(
    readPort(),
    process.env.HOST?.trim() || '0.0.0.0'
  );
}

bootstrap();
