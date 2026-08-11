import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? [
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AgencyOS API')
    .setDescription(
      'API for AgencyOS. Endpoints are grouped by which app consumes them — use the tag prefix to tell them apart.',
    )
    .setVersion('1.0')
    .addTag('Auth', 'Shared login/logout, used by every app')
    .addTag(
      'Admin - Companies',
      'Agency admin app: tenant/company management (SUPER_ADMIN)',
    )
    .addTag(
      'Admin - Users',
      'Agency admin app: user/employee CRUD, profiles, bank details, skills, documents',
    )
    .addTag('Admin - Clients', 'Agency admin app: client CRM (minimal)')
    .addTag(
      'Admin - Projects',
      'Agency admin app: projects, nested under a client within a company',
    )
    .addTag(
      'Admin - Workspaces',
      'Agency admin app: workspaces nested under a project, with member management',
    )
    .addTag(
      'Admin - Roles',
      'Agency admin app: read-only role lookup for assigning users',
    )
    .addTag('Employee', 'Staff self-service app')
    .addTag('Client Portal', 'Client-facing app')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: { tagsSorter: 'alpha', operationsSorter: 'alpha' },
  });

  await app.listen(process.env.PORT ?? 5007);
}
bootstrap();
