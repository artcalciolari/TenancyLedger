import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'node:path';
import { createDatabaseSslOptions } from './ssl.options';

export function createTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const useSsl = config.get<boolean>('DB_SSL', false);

  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_DATABASE'),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    migrationsTableName: 'typeorm_migrations',
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    logging: config.get<boolean>('DB_LOGGING', false),
    ssl: createDatabaseSslOptions(useSsl, {
      caFile: config.get<string>('DB_SSL_CA_FILE'),
      certFile: config.get<string>('DB_SSL_CERT_FILE'),
      keyFile: config.get<string>('DB_SSL_KEY_FILE'),
    }),
  };
}
