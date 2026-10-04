/**
 * Vercel serverless entry — Root Directory = apps/api
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import express, { Express } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

let cached: Express | null = null;

function healthPayload() {
  return {
    status: 'ok',
    service: 'fast-equb-api',
    timestamp: new Date().toISOString(),
    demoMode: process.env.DEMO_MODE !== 'false',
    realMoneyEnabled: process.env.REAL_MONEY_ENABLED === 'true',
    database: Boolean(process.env.DATABASE_URL?.trim()),
    admin: Boolean(process.env.DATABASE_URL?.trim()),
    auth: Boolean(process.env.DATABASE_URL?.trim()),
    equb: true,
  };
}

async function bootstrap(): Promise<Express> {
  if (cached) return cached;

  const server = express();

  server.get('/', (_req, res) => {
    res.json({
      ...healthPayload(),
      docs: '/api/docs',
      health: '/api/health',
      adminDashboard: '/api/admin/dashboard',
      authRegister: 'POST /api/auth/register',
      templates: '/api/equb/templates',
    });
  });
  server.get('/health', (_req, res) => {
    res.json({ success: true, data: healthPayload() });
  });
  server.get('/api/health', (_req, res) => {
    res.json({ success: true, data: healthPayload() });
  });

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const prefix = config.get<string>('API_PREFIX', 'api');

  app.setGlobalPrefix(prefix, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') ||
    config.get<string>('APP_URL') ||
    process.env.CORS_ORIGINS ||
    process.env.APP_URL ||
    '*'
  )
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      const allowed =
        corsOrigins.includes('*') ||
        corsOrigins.includes(normalized) ||
        /\.vercel\.app$/i.test(normalized) ||
        /^http:\/\/localhost(:\d+)?$/i.test(normalized);
      if (allowed) return callback(null, true);
      Logger.warn(`CORS blocked: ${origin}`, 'CORS');
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Idempotency-Key',
      'Idempotency-Key',
      'Accept',
      'Origin',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();
  cached = server;
  Logger.log(
    `API ready — database=${Boolean(process.env.DATABASE_URL)} admin=${Boolean(process.env.DATABASE_URL)}`,
    'Bootstrap',
  );
  return server;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const server = await bootstrap();
  return new Promise<void>((resolve) => {
    server(req as any, res as any, () => resolve());
  });
}
