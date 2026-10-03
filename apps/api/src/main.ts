import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const prefix = config.get<string>('API_PREFIX', 'api');

  app.setGlobalPrefix(prefix, {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

  const corsOrigins = (
    config.get<string>('CORS_ORIGINS') ||
    config.get<string>('APP_URL') ||
    process.env.CORS_ORIGINS ||
    'http://localhost:3000,http://localhost:3002,https://abelgame.vercel.app'
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
        corsOrigins.includes(origin) ||
        /\.vercel\.app$/i.test(normalized) ||
        /^http:\/\/localhost(:\d+)?$/i.test(normalized) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(normalized);
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
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fast Equb API')
    .setDescription('Equb multiplayer — virtual Birr demo.')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${prefix}/docs`, app, document);

  await app.listen(port, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`API on :${port} — GET /  /health  /${prefix}/health`);
}

bootstrap();
