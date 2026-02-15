import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Préfixe global pour l'API
  app.setGlobalPrefix('api');

  // Validation globale avec class-validator
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

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle('Diabetes Management API')
    .setDescription('API REST pour la gestion du diabète - Patients, Médecins, Pharmaciens')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentification et inscription')
    .addTag('Users', 'Gestion des utilisateurs')
    .addTag('Patients', 'Gestion des patients')
    .addTag('Médecins', 'Gestion des médecins')
    .addTag('Pharmaciens', 'Gestion des pharmaciens')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3002;
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
