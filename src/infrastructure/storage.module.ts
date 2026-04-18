import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

export const S3_CLIENT = Symbol('S3_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
      {
        const endpoint = config.get<string>('MINIO_ENDPOINT') || 'localhost';
        const port = config.get<number>('MINIO_PORT') || 9000;
        const protocol = config.get<string>('MINIO_USE_SSL') === 'true' ? 'https' : 'http';

        return new S3Client({
          endpoint: `${protocol}://${endpoint}:${port}`,
          region: 'us-east-1', // Obrigatório, mesmo pro MinIO local
          credentials: {
            accessKeyId: config.get<string>('MINIO_ACCESS_KEY') || 'minioadmin',
            secretAccessKey: config.get<string>('MINIO_SECRET_KEY') || 'minioadmin',
          },
          forcePathStyle: true, // Essencial para o MinIO não tentar usar subdomínios virtuais
        });
      },
    },
  ],
  exports: [S3_CLIENT],
})
export class StorageModule {}
