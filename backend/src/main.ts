import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'dotenv/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const preferredPorts = [Number(process.env.PORT), 3002, 3003, 3004, 3005];

  app.setGlobalPrefix('v1');

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
