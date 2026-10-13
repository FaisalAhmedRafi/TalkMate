import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', 1);
  app.use(json({ limit: '6mb' }));
  const origins = (process.env.FRONTEND_URL ?? 'http://localhost:3000').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Listening on 0.0.0.0:${port}`, 'Bootstrap');
}
bootstrap();