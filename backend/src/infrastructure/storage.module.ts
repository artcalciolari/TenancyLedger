import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { S3_CLIENT, S3_PRESIGN_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';
import { DOCUMENT_RENDERER, PdfKitDocumentRenderer } from './pdf/document-renderer';

export { S3_CLIENT, S3_PRESIGN_CLIENT } from './storage.constants';

@Global()
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): S3Client => {
        const endpoint = config.getOrThrow<string>('MINIO_ENDPOINT');
        const port = config.getOrThrow<number>('MINIO_PORT');
        const protocol = config.get<boolean>('MINIO_USE_SSL', false) ? 'https' : 'http';

        return new S3Client({
          endpoint: `${protocol}://${endpoint}:${port}`,
          region: 'us-east-1',
          credentials: {
            accessKeyId: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
            secretAccessKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
          },
          forcePathStyle: true,
          maxAttempts: 3,
          requestHandler: new NodeHttpHandler({
            connectionTimeout: 2_000,
            socketTimeout: 5_000,
          }),
        });
      },
    },
    {
      provide: S3_PRESIGN_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): S3Client =>
        new S3Client({
          endpoint: config.getOrThrow<string>('MINIO_PUBLIC_ENDPOINT'),
          region: 'us-east-1',
          credentials: {
            accessKeyId: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
            secretAccessKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
          },
          forcePathStyle: true,
        }),
    },
    PdfKitDocumentRenderer,
    {
      provide: DOCUMENT_RENDERER,
      useExisting: PdfKitDocumentRenderer,
    },
    StorageService,
  ],
  exports: [S3_CLIENT, S3_PRESIGN_CLIENT, DOCUMENT_RENDERER, StorageService],
})
export class StorageModule {}
