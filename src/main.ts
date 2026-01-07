import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { logger } from './config/logger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Global prefix
  const apiPrefix = configService.get<string>('app.apiPrefix');
  const apiVersion = configService.get<string>('app.apiVersion');
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  // CORS
  const corsOrigin = configService.get<string>('app.corsOrigin');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  // Global pipes, filters, and interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger documentation
  const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle(process.env.SWAGGER_TITLE || 'SwiftEats API')
      .setDescription(process.env.SWAGGER_DESCRIPTION || 'Real-Time Food Delivery Platform API')
      .setVersion(process.env.SWAGGER_VERSION || '1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management endpoints')
      .addTag('restaurants', 'Restaurant endpoints')
      .addTag('orders', 'Order management endpoints')
      .addTag('drivers', 'Driver endpoints')
      .addTag('deliveries', 'Delivery endpoints')
      .addTag('admin', 'Admin endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.info('Swagger documentation available at /api');
  }

  // Start server
  const port = configService.get<number>('app.port') || 4000;
  await app.listen(port);

  logger.info(`Application is running on: http://localhost:${port}/${apiPrefix}/${apiVersion}`);
  logger.info(`Environment: ${configService.get<string>('app.nodeEnv')}`);
}

bootstrap().catch((error) => {
  logger.error('Failed to start application', { error: error.message, stack: error.stack });
  process.exit(1);
});
