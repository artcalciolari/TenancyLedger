import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { S3_CLIENT, S3_PRESIGN_CLIENT } from './storage.constants';

const maxProofSizeBytes = 10 * 1024 * 1024;
const allowedProofContentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const invoiceIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storedProofKeyPattern = new RegExp(
  `^payment-proofs/${invoiceIdPattern.source.slice(1, -1)}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp)$`,
  'i',
);

export interface StoredObject {
  bucket: string;
  key: string;
}

export interface UploadProofInput {
  invoiceId: string;
  originalName: string;
  contentType: string;
  body: Buffer;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly presignClient: S3Client;

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    private readonly config: ConfigService,
    @Optional()
    @Inject(S3_PRESIGN_CLIENT)
    presignClient?: S3Client,
  ) {
    this.bucket = config.getOrThrow<string>('MINIO_BUCKET_NAME');
    this.presignClient = presignClient ?? client;
  }

  async onModuleInit(): Promise<void> {
    const environment = this.config.get<string>('NODE_ENV');
    if (environment === 'test') return;

    if (this.config.get<boolean>('MINIO_AUTO_CREATE_BUCKET', false)) {
      await this.ensureBucket();
    } else {
      await this.checkConnection();
    }

    if (environment === 'production') await this.verifyProductionWriteCapability();
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error: unknown) {
      const status = this.statusCodeFrom(error);
      if (status !== 404) throw error;

      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created private object-storage bucket ${this.bucket}`);
      } catch (createError: unknown) {
        if (this.statusCodeFrom(createError) !== 409) throw createError;
      }
    }
  }

  async checkConnection(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async uploadPaymentProof(input: UploadProofInput): Promise<StoredObject> {
    if (!allowedProofContentTypes.has(input.contentType)) {
      throw new BadRequestException('Unsupported proof content type');
    }
    if (input.body.length === 0 || input.body.length > maxProofSizeBytes) {
      throw new BadRequestException('Proof must be between 1 byte and 10 MiB');
    }
    if (!invoiceIdPattern.test(input.invoiceId)) {
      throw new BadRequestException('Invoice id must be a valid UUID');
    }

    const detected = this.detectFileType(input.body);
    if (!detected || detected.contentType !== input.contentType) {
      throw new BadRequestException('Proof content does not match the declared content type');
    }

    const key = `payment-proofs/${input.invoiceId}/${randomUUID()}.${detected.extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.body.length,
        Metadata: { invoiceId: input.invoiceId },
        ServerSideEncryption: this.config.get<boolean>('STORAGE_SSE_ENABLED', false)
          ? 'AES256'
          : undefined,
      }),
    );

    return { bucket: this.bucket, key };
  }

  async createReadUrl(key: string, expiresInSeconds = 300): Promise<string> {
    if (!storedProofKeyPattern.test(key)) {
      throw new BadRequestException('Invalid payment-proof object key');
    }
    if (expiresInSeconds < 1 || expiresInSeconds > 900) {
      throw new BadRequestException('Signed URL expiry must be between 1 and 900 seconds');
    }

    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: 'attachment',
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async deleteObject(key: string): Promise<void> {
    if (!storedProofKeyPattern.test(key)) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private async verifyProductionWriteCapability(): Promise<void> {
    const key = `_health/sse-write-probe/${randomUUID()}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: Buffer.from('ok'),
        ContentType: 'text/plain',
        ContentLength: 2,
        ServerSideEncryption: 'AES256',
      }),
    );
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private detectFileType(body: Buffer): { contentType: string; extension: string } | null {
    if (body.subarray(0, 5).toString('ascii') === '%PDF-') {
      return { contentType: 'application/pdf', extension: 'pdf' };
    }
    if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
      return { contentType: 'image/jpeg', extension: 'jpg' };
    }
    if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { contentType: 'image/png', extension: 'png' };
    }
    if (
      body.subarray(0, 4).toString('ascii') === 'RIFF' &&
      body.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { contentType: 'image/webp', extension: 'webp' };
    }
    return null;
  }

  private statusCodeFrom(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const metadata = Reflect.get(error, '$metadata') as unknown;
    if (typeof metadata !== 'object' || metadata === null) return undefined;
    const status = Reflect.get(metadata, 'httpStatusCode') as unknown;
    return typeof status === 'number' ? status : undefined;
  }
}
