import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = process.env.FRONTEND_URL;
  const enableSwagger =
    process.env.ENABLE_SWAGGER?.toLowerCase() === 'true' ||
    process.env.NODE_ENV !== 'production';

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: frontendUrl ?? true,
    credentials: true,
  });

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Personal Dashboard API')
      .setDescription('API for the personal management dashboard.')
      .setVersion('0.1.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
