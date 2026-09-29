import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const bodyLimit = config.get<string>('requestBodyLimit') ?? '1mb';

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  app.enableCors({
    origin: config.get<string[]>('corsOrigins') ?? [],
    credentials: true,
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
  app.useGlobalInterceptors(new RequestLoggingInterceptor(), new ResponseInterceptor());
  app.enableShutdownHooks();

  const swagger = new DocumentBuilder()
    .setTitle('wellConnect Wellness API')
    .setDescription(
      [
        'Wellness ingestion, deterministic decisioning, AI personalization, and Firebase notifications for premium properties.',
        '',
        'Recommendation routes under /api/v1/wellness:',
        '- GET /profile',
        '- GET /recommendations',
        '- GET /recommendations/today (query: date?, propertyId?)',
        '- POST /recommendations/generate',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(
    `wellness_api_started port=${port} demoMode=${config.get('demoMode')} fcmConfigured=${Boolean(config.get('firebaseProjectId'))} openaiConfigured=${Boolean(config.get('openaiApiKey'))}`,
  );
}

void bootstrap();
