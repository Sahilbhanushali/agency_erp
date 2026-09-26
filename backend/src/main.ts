import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { assertRequiredConfig } from './common/utils/required-config.util';

async function bootstrap() {
  // Fail here, not halfway through creating a user.
  assertRequiredConfig(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind nginx, req.ip is the proxy unless Express is told to trust it — the audit
  // trail records that value, so without this every entry reads 127.0.0.1.
  app.set('trust proxy', 'loopback');
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') ?? [
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  });
  // Constraint violations become 409/400/404 instead of leaking a 500 with a stack trace.
  app.useGlobalFilters(
    new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter),
  );

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
      'Admin - Tasks',
      'Agency admin app: project tasks, sub-tasks and comments',
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
