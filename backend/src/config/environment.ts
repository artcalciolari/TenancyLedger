import Joi from 'joi';

const developmentJwtSecret = 'development-only-jwt-secret-change-me';
const knownBootstrapPasswords = new Set(['change-me-now', 'ChangeMeNow123!']);

const booleanValue = Joi.boolean().truthy('true').falsy('false');

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGINS: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().default('http://localhost:5173'),
  }),
  SWAGGER_ENABLED: booleanValue.when('NODE_ENV', {
    is: 'production',
    then: booleanValue.default(false),
    otherwise: booleanValue.default(true),
  }),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  DB_HOST: Joi.string()
    .hostname()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().hostname().default('localhost'),
    }),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string()
    .min(1)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('postgres'),
    }),
  DB_PASSWORD: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(12).required(),
    otherwise: Joi.string().allow('').default('postgres'),
  }),
  DB_DATABASE: Joi.string()
    .min(1)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('tenancyledger'),
    }),
  DB_SSL: booleanValue.when('NODE_ENV', {
    is: 'production',
    then: Joi.valid(true).required(),
    otherwise: booleanValue.default(false),
  }),
  DB_SSL_CA_FILE: Joi.string().empty('').min(1),
  DB_SSL_CERT_FILE: Joi.string().empty('').min(1),
  DB_SSL_KEY_FILE: Joi.string().empty('').min(1),
  DB_LOGGING: booleanValue.default(false),

  JWT_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default(developmentJwtSecret),
    }),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^([1-9]\d*)([smhd])$/)
    .default('15m'),
  JWT_ISSUER: Joi.string().min(3).default('tenancy-ledger'),
  JWT_AUDIENCE: Joi.string().min(3).default('tenancy-ledger-api'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(365).default(30),
  AUTH_BOOTSTRAP_EMAIL: Joi.string().email({ tlds: { allow: false } }),
  AUTH_BOOTSTRAP_PASSWORD: Joi.string()
    .min(12)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),

  THROTTLE_TTL_MS: Joi.number().integer().positive().default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  METRICS_TOKEN: Joi.string()
    .min(24)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('development-metrics-token'),
    }),

  MINIO_ENDPOINT: Joi.string()
    .hostname()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().hostname().default('localhost'),
    }),
  MINIO_PORT: Joi.number().port().default(9000),
  MINIO_PUBLIC_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .uri({ scheme: ['https'] })
        .required(),
      otherwise: Joi.string().default('http://localhost:9000'),
    }),
  MINIO_ACCESS_KEY: Joi.string()
    .min(3)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('minioadmin'),
    }),
  MINIO_SECRET_KEY: Joi.string()
    .min(8)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('minioadmin'),
    }),
  MINIO_BUCKET_NAME: Joi.string().min(3).default('payment-proofs'),
  MINIO_USE_SSL: booleanValue.when('NODE_ENV', {
    is: 'production',
    then: Joi.valid(true).required(),
    otherwise: booleanValue.default(false),
  }),
  MINIO_AUTO_CREATE_BUCKET: booleanValue.when('NODE_ENV', {
    is: 'production',
    then: Joi.valid(false).default(false),
    otherwise: booleanValue.default(true),
  }),
  STORAGE_SSE_ENABLED: booleanValue.when('NODE_ENV', {
    is: 'production',
    then: Joi.valid(true).required(),
    otherwise: booleanValue.default(false),
  }),

  INVOICE_CRON_ENABLED: booleanValue.default(true),
  INVOICE_CRON_TIME_ZONE: Joi.string().default('America/Sao_Paulo'),
  INVOICE_GENERATION_DAYS_AHEAD: Joi.number().integer().min(0).max(31).default(7),
})
  .and('AUTH_BOOTSTRAP_EMAIL', 'AUTH_BOOTSTRAP_PASSWORD')
  .and('DB_SSL_CERT_FILE', 'DB_SSL_KEY_FILE')
  .custom((value: Record<string, unknown>, helpers) => {
    const corsOrigins = String(value.CORS_ORIGINS)
      .split(',')
      .map((origin) => origin.trim());
    if (
      corsOrigins.some((origin) => {
        if (!origin || origin === '*') return true;
        try {
          const parsed = new URL(origin);
          return parsed.protocol !== 'http:' && parsed.protocol !== 'https:';
        } catch {
          return true;
        }
      })
    ) {
      return helpers.error('environment.invalidCorsOrigins');
    }

    if (value.NODE_ENV !== 'production') return value;

    if (
      value.JWT_SECRET === developmentJwtSecret ||
      String(value.JWT_SECRET).includes('local-development')
    ) {
      return helpers.error('environment.productionJwtSecret');
    }
    if (value.METRICS_TOKEN === 'development-metrics-token') {
      return helpers.error('environment.productionMetricsToken');
    }
    if (value.DB_USERNAME === 'postgres' || value.DB_PASSWORD === 'postgres') {
      return helpers.error('environment.productionDatabaseCredentials');
    }
    if (value.MINIO_ACCESS_KEY === 'minioadmin' || value.MINIO_SECRET_KEY === 'minioadmin') {
      return helpers.error('environment.productionMinioCredentials');
    }
    if (
      typeof value.AUTH_BOOTSTRAP_PASSWORD === 'string' &&
      (value.AUTH_BOOTSTRAP_PASSWORD.length < 16 ||
        knownBootstrapPasswords.has(value.AUTH_BOOTSTRAP_PASSWORD))
    ) {
      return helpers.error('environment.productionBootstrapPassword');
    }

    return value;
  })
  .messages({
    'environment.invalidCorsOrigins':
      'CORS_ORIGINS must be a comma-separated list of http(s) origins; wildcard is forbidden',
    'environment.productionJwtSecret':
      'JWT_SECRET must be an explicit, non-development secret in production',
    'environment.productionMetricsToken':
      'METRICS_TOKEN must be an explicit, non-development secret in production',
    'environment.productionDatabaseCredentials':
      'Default PostgreSQL credentials are forbidden in production',
    'environment.productionMinioCredentials':
      'Default MinIO credentials are forbidden in production',
    'environment.productionBootstrapPassword':
      'The production bootstrap password must be unique and at least 16 characters',
    'object.and': '{{#presentWithLabels}} must be configured together',
  });

export const databaseEnvironmentSchema = Joi.object({
  NODE_ENV: environmentSchema.extract('NODE_ENV'),
  DB_HOST: environmentSchema.extract('DB_HOST'),
  DB_PORT: environmentSchema.extract('DB_PORT'),
  DB_USERNAME: environmentSchema.extract('DB_USERNAME'),
  DB_PASSWORD: environmentSchema.extract('DB_PASSWORD'),
  DB_DATABASE: environmentSchema.extract('DB_DATABASE'),
  DB_SSL: environmentSchema.extract('DB_SSL'),
  DB_SSL_CA_FILE: environmentSchema.extract('DB_SSL_CA_FILE'),
  DB_SSL_CERT_FILE: environmentSchema.extract('DB_SSL_CERT_FILE'),
  DB_SSL_KEY_FILE: environmentSchema.extract('DB_SSL_KEY_FILE'),
  DB_LOGGING: environmentSchema.extract('DB_LOGGING'),
})
  .and('DB_SSL_CERT_FILE', 'DB_SSL_KEY_FILE')
  .custom((value: Record<string, unknown>, helpers) => {
    if (
      value.NODE_ENV === 'production' &&
      (value.DB_USERNAME === 'postgres' || value.DB_PASSWORD === 'postgres')
    ) {
      return helpers.error('environment.productionDatabaseCredentials');
    }
    return value;
  })
  .messages({
    'environment.productionDatabaseCredentials':
      'Default PostgreSQL credentials are forbidden in production',
    'object.and': '{{#presentWithLabels}} must be configured together',
  });
