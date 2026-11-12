import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { MEDIA_DIR } from './word/word.images';

async function bootstrap() {
  // A short JWT_SECRET can be brute-forced offline from any issued token.
  if ((process.env.JWT_SECRET ?? '').length < 32) {
    Logger.warn('JWT_SECRET is shorter than 32 characters. Use `openssl rand -hex 32` in production.', 'Bootstrap');
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  // Security headers (NIST CSF 2.0 PR.PS, see docs/security.md). The API only serves JSON and /media pictures,
  // so nothing may run or be framed; pictures stay cross-origin readable because the frontend lives elsewhere.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    next();
  });
  app.use(json({ limit: '6mb' }));
  const origins = (process.env.FRONTEND_URL ?? 'http://localhost:3000').split(',').map((s) => s.trim());
  // CORS first, so the pictures below also carry the CORS header (Photo Mode shrinks an uploaded photo on a canvas)
  app.enableCors({ origin: origins });
  // stock photos downloaded from Pixabay (see WordImageService) and pictures uploaded in the admin panel
  app.useStaticAssets(MEDIA_DIR, { prefix: '/media/', maxAge: '7d' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Listening on 0.0.0.0:${port}`, 'Bootstrap');
}
bootstrap();