import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseEnvironmentSchema } from '../config/environment';
import { createDatabaseSslOptions } from './ssl.options';

const validationResult = databaseEnvironmentSchema.validate(process.env, {
  abortEarly: false,
  allowUnknown: true,
  convert: true,
}) as { error?: Error; value: unknown };

if (validationResult.error) {
  throw new Error(`Invalid environment configuration: ${validationResult.error.message}`);
}

const env = validationResult.value as Record<string, unknown>;
const useSsl = env.DB_SSL === true;

export default new DataSource({
  type: 'postgres',
  host: String(env.DB_HOST),
  port: Number(env.DB_PORT),
  username: String(env.DB_USERNAME),
  password: String(env.DB_PASSWORD),
  database: String(env.DB_DATABASE),
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: env.DB_LOGGING === true,
  ssl: createDatabaseSslOptions(useSsl, {
    caFile: typeof env.DB_SSL_CA_FILE === 'string' ? env.DB_SSL_CA_FILE : undefined,
    certFile: typeof env.DB_SSL_CERT_FILE === 'string' ? env.DB_SSL_CERT_FILE : undefined,
    keyFile: typeof env.DB_SSL_KEY_FILE === 'string' ? env.DB_SSL_KEY_FILE : undefined,
  }),
});
