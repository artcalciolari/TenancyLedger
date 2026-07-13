import { databaseEnvironmentSchema, environmentSchema } from './environment';

const validProductionEnvironment = {
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://app.example.com, https://admin.example.com',
  DB_HOST: 'postgres.internal',
  DB_USERNAME: 'tenancy_app',
  DB_PASSWORD: 'a-strong-database-password',
  DB_DATABASE: 'tenancy_ledger',
  DB_SSL: true,
  JWT_SECRET: 'a-production-jwt-secret-with-ample-entropy',
  MINIO_ENDPOINT: 'storage.internal',
  MINIO_PUBLIC_ENDPOINT: 'https://storage.example.com',
  MINIO_ACCESS_KEY: 'tenancy-storage',
  MINIO_SECRET_KEY: 'a-strong-storage-secret',
  MINIO_USE_SSL: true,
  STORAGE_SSE_ENABLED: true,
  METRICS_TOKEN: 'production-metrics-token-with-ample-entropy',
} as const;

describe('environmentSchema', () => {
  it('aplica defaults seguros e convenientes em desenvolvimento', () => {
    const result = environmentSchema.validate({});
    const value = result.value as Record<string, unknown>;

    expect(result.error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      CORS_ORIGINS: 'http://localhost:5173',
      SWAGGER_ENABLED: true,
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_DATABASE: 'tenancyledger',
      DB_SSL: false,
      JWT_SECRET: 'development-only-jwt-secret-change-me',
      JWT_EXPIRES_IN: '15m',
      JWT_ISSUER: 'tenancy-ledger',
      JWT_AUDIENCE: 'tenancy-ledger-api',
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: 9000,
      MINIO_PUBLIC_ENDPOINT: 'http://localhost:9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      MINIO_USE_SSL: false,
      MINIO_AUTO_CREATE_BUCKET: true,
      STORAGE_SSE_ENABLED: false,
      METRICS_TOKEN: 'development-metrics-token',
    });
  });

  it.each(['15', '0m', '1y', '-1h', ' 15m '])(
    'rejeita JWT_EXPIRES_IN inválido: %s',
    (JWT_EXPIRES_IN) => {
      const { error } = environmentSchema.validate({ JWT_EXPIRES_IN });

      expect(error?.details[0]?.path).toEqual(['JWT_EXPIRES_IN']);
    },
  );

  it.each(['*', 'https://app.example.com,*', 'ftp://app.example.com', 'not a URL'])(
    'rejeita origem CORS insegura ou inválida: %s',
    (CORS_ORIGINS) => {
      const { error } = environmentSchema.validate({ CORS_ORIGINS });

      expect(error?.message).toContain(
        'CORS_ORIGINS must be a comma-separated list of http(s) origins; wildcard is forbidden',
      );
    },
  );

  it('rejeita CORS_ORIGINS vazio', () => {
    const { error } = environmentSchema.validate({ CORS_ORIGINS: '' });

    expect(error?.details[0]?.path).toEqual(['CORS_ORIGINS']);
  });

  it.each([
    'DB_HOST',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_DATABASE',
    'JWT_SECRET',
    'MINIO_ENDPOINT',
    'MINIO_PUBLIC_ENDPOINT',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'DB_SSL',
    'MINIO_USE_SSL',
    'STORAGE_SSE_ENABLED',
    'METRICS_TOKEN',
  ] as const)('exige %s em produção', (key) => {
    const environment: Record<string, unknown> = { ...validProductionEnvironment };
    delete environment[key];

    const { error } = environmentSchema.validate(environment, { abortEarly: false });

    expect(error?.details.some((detail) => detail.path[0] === key)).toBe(true);
  });

  it.each([
    {
      override: { JWT_SECRET: 'development-only-jwt-secret-change-me' },
      message: 'JWT_SECRET must be an explicit, non-development secret in production',
    },
    {
      override: { JWT_SECRET: 'local-development-secret-that-is-long-enough' },
      message: 'JWT_SECRET must be an explicit, non-development secret in production',
    },
    {
      override: { DB_USERNAME: 'postgres' },
      message: 'Default PostgreSQL credentials are forbidden in production',
    },
    {
      override: { METRICS_TOKEN: 'development-metrics-token' },
      message: 'METRICS_TOKEN must be an explicit, non-development secret in production',
    },
    {
      override: { MINIO_ACCESS_KEY: 'minioadmin' },
      message: 'Default MinIO credentials are forbidden in production',
    },
    {
      override: { MINIO_SECRET_KEY: 'minioadmin' },
      message: 'Default MinIO credentials are forbidden in production',
    },
  ])('rejeita credenciais/defaults conhecidos em produção: $message', ({ override, message }) => {
    const { error } = environmentSchema.validate({
      ...validProductionEnvironment,
      ...override,
    });

    expect(error?.message).toContain(message);
  });

  it('rejeita a senha padrão do PostgreSQL em produção', () => {
    const { error } = environmentSchema.validate({
      ...validProductionEnvironment,
      DB_PASSWORD: 'postgres',
    });

    expect(error?.details.some((detail) => detail.path[0] === 'DB_PASSWORD')).toBe(true);
  });

  it.each(['change-me-now', 'ChangeMeNow123!', 'only-12chars'])(
    'rejeita senha de bootstrap fraca em produção: %s',
    (AUTH_BOOTSTRAP_PASSWORD) => {
      const { error } = environmentSchema.validate({
        ...validProductionEnvironment,
        AUTH_BOOTSTRAP_EMAIL: 'admin@example.com',
        AUTH_BOOTSTRAP_PASSWORD,
      });

      expect(error).toBeDefined();
    },
  );

  it('aceita configuração completa e endurecida de produção', () => {
    const result = environmentSchema.validate({
      ...validProductionEnvironment,
      AUTH_BOOTSTRAP_EMAIL: 'admin@example.com',
      AUTH_BOOTSTRAP_PASSWORD: 'Unique-bootstrap-password-2026!',
    });
    const value = result.value as Record<string, unknown>;

    expect(result.error).toBeUndefined();
    expect(value).toMatchObject({
      ...validProductionEnvironment,
      SWAGGER_ENABLED: false,
      MINIO_AUTO_CREATE_BUCKET: false,
      AUTH_BOOTSTRAP_EMAIL: 'admin@example.com',
    });
  });

  it('exige certificado e chave de cliente PostgreSQL em conjunto', () => {
    const { error } = environmentSchema.validate({ DB_SSL_CERT_FILE: '/run/secrets/db.crt' });

    expect(error?.details[0]?.type).toBe('object.and');
  });

  it('valida jobs de migration apenas com a configuração do PostgreSQL', () => {
    const result = databaseEnvironmentSchema.validate({
      NODE_ENV: 'production',
      DB_HOST: 'postgres.internal',
      DB_USERNAME: 'migration_user',
      DB_PASSWORD: 'a-strong-database-password',
      DB_DATABASE: 'tenancy_ledger',
      DB_SSL: true,
    });

    expect(result.error).toBeUndefined();
    expect(result.value).not.toHaveProperty('JWT_SECRET');
    expect(result.value).not.toHaveProperty('MINIO_ENDPOINT');
  });
});
