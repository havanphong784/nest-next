import { NestFactory } from '@nestjs/core';
import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const preferredPorts = [
    Number(process.env.PORT) || 3000,
    3001,
    3002,
    3003,
    3004,
    3005,
  ];

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  for (const port of preferredPorts) {
    try {
      await app.listen(port);
      console.log(port);
      return;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EADDRINUSE') {
        throw error;
      }
    }
  }

  throw new Error('No available ports found for the Nest application.');
}
void bootstrap();
