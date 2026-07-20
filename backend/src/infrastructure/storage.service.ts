import {
  CopyObjectCommand,
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
const maxDocumentSizeBytes = 10 * 1024 * 1024;
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
const documentFolderPattern =
  /^(tenant-photos|contract-documents|receipts|onboarding-draft-photos)$/;
const storedDocumentKeyPattern = new RegExp(
  `^documents/${documentFolderPattern.source.slice(1, -1)}/${invoiceIdPattern.source.slice(1, -1)}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp|heic|heif)$`,
  'i',
);
const allowedDocumentContentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const allowedTenantPhotoContentTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
]);
const allowedOnboardingDraftPhotoContentTypes = allowedTenantPhotoContentTypes;
const storedOnboardingDraftPhotoKeyPattern = new RegExp(
  `^documents/onboarding-draft-photos/${invoiceIdPattern.source.slice(1, -1)}/[0-9a-f-]{36}\\.(jpg|png|heic|heif)$`,
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

export type DocumentFolder =
  'tenant-photos' | 'contract-documents' | 'receipts' | 'onboarding-draft-photos';

export interface UploadDocumentInput {
  folder: DocumentFolder;
  ownerId: string;
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

  async uploadDocument(input: UploadDocumentInput): Promise<StoredObject> {
    if (!documentFolderPattern.test(input.folder)) {
      throw new BadRequestException('Invalid document folder');
    }
    if (!invoiceIdPattern.test(input.ownerId)) {
      throw new BadRequestException('Document owner id must be a valid UUID');
    }
    if (!allowedDocumentContentTypes.has(input.contentType)) {
      throw new BadRequestException('Unsupported document content type');
    }
    if (
      input.folder === 'tenant-photos' &&
      !allowedTenantPhotoContentTypes.has(input.contentType)
    ) {
      throw new BadRequestException('Unsupported tenant photo content type');
    }
    if (
      input.folder === 'onboarding-draft-photos' &&
      !allowedOnboardingDraftPhotoContentTypes.has(input.contentType)
    ) {
      throw new BadRequestException('Unsupported onboarding draft photo content type');
    }
    if (input.body.length === 0 || input.body.length > maxDocumentSizeBytes) {
      throw new BadRequestException('Document must be between 1 byte and 10 MiB');
    }

    const detected = this.detectFileType(input.body);
    if (!detected || detected.contentType !== input.contentType) {
      throw new BadRequestException('Document content does not match the declared content type');
    }

    const key = `documents/${input.folder}/${input.ownerId}/${randomUUID()}.${detected.extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.body.length,
        Metadata: { ownerId: input.ownerId, documentFolder: input.folder },
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

  async createDocumentReadUrl(
    key: string,
    expiresInSeconds = 300,
    disposition: 'attachment' | 'inline' = 'attachment',
  ): Promise<string> {
    if (!storedDocumentKeyPattern.test(key)) {
      throw new BadRequestException('Invalid document object key');
    }
    this.assertValidExpiry(expiresInSeconds);

    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: disposition,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async deleteObject(key: string): Promise<void> {
    if (!storedProofKeyPattern.test(key) && !storedDocumentKeyPattern.test(key)) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async promoteDraftPhotoToTenant(sourceKey: string, tenantId: string): Promise<StoredObject> {
    if (!storedOnboardingDraftPhotoKeyPattern.test(sourceKey)) {
      throw new BadRequestException('Invalid onboarding draft photo object key');
    }
    if (!invoiceIdPattern.test(tenantId)) {
      throw new BadRequestException('Tenant id must be a valid UUID');
    }

    const extension = sourceKey.slice(sourceKey.lastIndexOf('.') + 1).toLowerCase();
    const key = `documents/tenant-photos/${tenantId}/${randomUUID()}.${extension}`;
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`.split('/').map(encodeURIComponent).join('/'),
        Key: key,
        MetadataDirective: 'REPLACE',
        Metadata: { ownerId: tenantId, documentFolder: 'tenant-photos' },
        ServerSideEncryption: this.config.get<boolean>('STORAGE_SSE_ENABLED', false)
          ? 'AES256'
          : undefined,
      }),
    );

    return { bucket: this.bucket, key };
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
    if (body.subarray(4, 12).toString('ascii').startsWith('ftyp')) {
      const brand = body.subarray(8, 12).toString('ascii');
      if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) {
        return { contentType: 'image/heic', extension: 'heic' };
      }
      if (['mif1', 'msf1'].includes(brand)) {
        return { contentType: 'image/heif', extension: 'heif' };
      }
    }
    return null;
  }

  private assertValidExpiry(expiresInSeconds: number): void {
    if (expiresInSeconds < 1 || expiresInSeconds > 900) {
      throw new BadRequestException('Signed URL expiry must be between 1 and 900 seconds');
    }
  }

  private statusCodeFrom(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;
    const metadata = Reflect.get(error, '$metadata') as unknown;
    if (typeof metadata !== 'object' || metadata === null) return undefined;
    const status = Reflect.get(metadata, 'httpStatusCode') as unknown;
    return typeof status === 'number' ? status : undefined;
  }
}
