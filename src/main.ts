import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const corsOrigins = (config.get<string>('CORS_ORIGIN') || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['x-request-id'],
    credentials: true,
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor(), new TimeoutInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sakila Facturación Electrónica Boliviana')
    .setDescription(
      'API académica de facturación electrónica con Sakila y PostgreSQL. ' +
        'NO certificada por el SIN. El proveedor por defecto es simulado. ' +
        'Los catálogos, reglas y XML oficiales requieren validación documental.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  app.enableShutdownHooks();
  const port = Number(config.get('PORT') || 3000);
  await app.listen(port);
  logger.log(`API escuchando en http://localhost:${port}/api`);
  logger.log(`Swagger en http://localhost:${port}/docs`);
  logger.log(`Proveedor tributario: ${config.get('SIAT_MODE') || 'simulated'}`);
}

bootstrap().catch((error) => {
  // No se imprimen secretos; solo el mensaje de fallo de arranque.
  console.error(`Fallo al iniciar la aplicación: ${(error as Error).message}`);
  process.exit(1);
});
