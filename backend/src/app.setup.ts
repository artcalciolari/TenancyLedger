import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, getSchemaPath, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { NextFunction, Request, Response } from 'express';
import { ProblemDetailsDto } from './core/infrastructure/http/openapi.dto';

const requestIdHeader = {
  description: 'Identificador de correlação da requisição.',
  schema: { type: 'string', minLength: 1, maxLength: 100 },
};

type OperationObject = NonNullable<OpenAPIObject['paths'][string]['get']>;

function problemResponse(description: string): OperationObject['responses'][string] {
  return {
    description,
    headers: { 'X-Request-ID': requestIdHeader },
    content: {
      'application/problem+json': {
        schema: { $ref: getSchemaPath(ProblemDetailsDto) },
      },
    },
  };
}

function enrichOpenApiDocument(document: OpenAPIObject): OpenAPIObject {
  const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

  for (const pathItem of Object.values(document.paths)) {
    if (!pathItem) continue;
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      operation.responses['400'] ??= problemResponse('Requisição inválida.');
      operation.responses['429'] ??= problemResponse('Limite de requisições excedido.');
      operation.responses['500'] ??= problemResponse('Erro interno inesperado.');

      if (operation.security?.some((requirement) => 'bearer' in requirement)) {
        operation.responses['401'] ??= problemResponse('Token ausente, inválido ou expirado.');
        operation.responses['403'] ??= problemResponse('Papel sem permissão para a operação.');
      }

      for (const response of Object.values(operation.responses)) {
        if (!response) continue;
        if ('$ref' in response) continue;
        response.headers = { ...response.headers, 'X-Request-ID': requestIdHeader };
      }
    }
  }

  return document;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tenancy Ledger API')
    .setDescription('API para gestão auditável de inquilinos, imóveis, contratos e cobranças.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT de acesso.' },
      'bearer',
    )
    .build();

  return enrichOpenApiDocument(
    SwaggerModule.createDocument(app, swaggerConfig, { extraModels: [ProblemDetailsDto] }),
  );
}

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const production = config.get<string>('NODE_ENV') === 'production';

  app.use((request: Request, response: Response, next: NextFunction): void => {
    const incoming = request.header('x-request-id');
    const requestId =
      incoming && /^[a-zA-Z0-9._:-]{1,100}$/.test(incoming) ? incoming : randomUUID();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: production ? undefined : false,
    }),
  );
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );

  if (config.get<boolean>('SWAGGER_ENABLED', true)) {
    SwaggerModule.setup('docs', app, createOpenApiDocument(app));
  }
}
