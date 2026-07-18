import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

const bucket = 'payment-proofs';
const invoiceId = '550e8400-e29b-41d4-a716-446655440000';
const storedKey =
  'payment-proofs/550e8400-e29b-41d4-a716-446655440000/123e4567-e89b-42d3-a456-426614174000.pdf';

describe('StorageService', () => {
  let send: jest.MockedFunction<(command: unknown) => Promise<unknown>>;
  let configGet: jest.Mock;
  let client: S3Client;
  let config: ConfigService;
  let service: StorageService;

  beforeEach(() => {
    send = jest.fn<Promise<unknown>, [unknown]>();
    configGet = jest.fn((_key: string, fallback?: unknown) => fallback);
    client = { send } as unknown as S3Client;
    config = {
      getOrThrow: jest.fn().mockReturnValue(bucket),
      get: configGet,
    } as unknown as ConfigService;

    service = new StorageService(client, config);
    jest.mocked(getSignedUrl).mockReset();
  });

  describe('uploadPaymentProof', () => {
    it('rejects a content type outside the allowlist', async () => {
      await expect(
        service.uploadPaymentProof({
          invoiceId,
          originalName: 'proof.txt',
          contentType: 'text/plain',
          body: Buffer.from('plain text'),
        }),
      ).rejects.toThrow(new BadRequestException('Unsupported proof content type'));

      expect(send).not.toHaveBeenCalled();
    });

    it('rejects a declared MIME type that differs from the file signature', async () => {
      await expect(
        service.uploadPaymentProof({
          invoiceId,
          originalName: 'renamed.png',
          contentType: 'image/png',
          body: Buffer.from('%PDF-1.7\n'),
        }),
      ).rejects.toThrow(
        new BadRequestException('Proof content does not match the declared content type'),
      );

      expect(send).not.toHaveBeenCalled();
    });

    it.each([
      ['empty', Buffer.alloc(0)],
      ['larger than 10 MiB', Buffer.alloc(10 * 1024 * 1024 + 1)],
    ])('rejects a %s body', async (_description, body) => {
      await expect(
        service.uploadPaymentProof({
          invoiceId,
          originalName: 'proof.pdf',
          contentType: 'application/pdf',
          body,
        }),
      ).rejects.toThrow(new BadRequestException('Proof must be between 1 byte and 10 MiB'));

      expect(send).not.toHaveBeenCalled();
    });

    it('rejects an invalid invoice UUID before uploading', async () => {
      await expect(
        service.uploadPaymentProof({
          invoiceId: '../../another-tenant',
          originalName: 'proof.pdf',
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-1.7\n'),
        }),
      ).rejects.toThrow(new BadRequestException('Invoice id must be a valid UUID'));

      expect(send).not.toHaveBeenCalled();
    });

    it('builds a tenant-safe key and uploads the detected file type', async () => {
      send.mockResolvedValue({});
      configGet.mockImplementation((key: string, fallback?: unknown) =>
        key === 'STORAGE_SSE_ENABLED' ? true : fallback,
      );

      const result = await service.uploadPaymentProof({
        invoiceId,
        originalName: '../../malicious-name.pdf',
        contentType: 'application/pdf',
        body: Buffer.from('%PDF-1.7\nproof'),
      });

      expect(result.bucket).toBe(bucket);
      expect(result.key).toMatch(
        new RegExp(`^payment-proofs/${invoiceId}/[0-9a-f-]{36}\\.pdf$`, 'i'),
      );
      expect(result.key).not.toContain('malicious-name');
      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0]?.[0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input).toMatchObject({
        Bucket: bucket,
        Key: result.key,
        ContentType: 'application/pdf',
        ContentLength: 14,
        Metadata: { invoiceId },
        ServerSideEncryption: 'AES256',
      });
    });

    it.each([
      ['JPEG', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'jpg'],
      ['PNG', 'image/png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'png'],
      [
        'WebP',
        'image/webp',
        Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
        'webp',
      ],
    ])(
      'detects and uploads a valid %s proof without enabling encryption by default',
      async (_description, contentType, body, extension) => {
        send.mockResolvedValue({});

        const result = await service.uploadPaymentProof({
          invoiceId,
          originalName: `proof.${extension}`,
          contentType,
          body,
        });

        expect(result.key).toMatch(new RegExp(`^payment-proofs/${invoiceId}/.+\\.${extension}$`));
        const command = send.mock.calls[0]?.[0] as PutObjectCommand;
        expect(command.input).toMatchObject({
          Bucket: bucket,
          Key: result.key,
          ContentType: contentType,
          ContentLength: body.length,
          ServerSideEncryption: undefined,
        });
      },
    );

    it('rejects an allowlisted MIME type when the payload has no recognized signature', async () => {
      await expect(
        service.uploadPaymentProof({
          invoiceId,
          originalName: 'fake.png',
          contentType: 'image/png',
          body: Buffer.from('not a real image'),
        }),
      ).rejects.toThrow(
        new BadRequestException('Proof content does not match the declared content type'),
      );

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('createReadUrl', () => {
    it.each([
      ['an unrelated key', 'other/file.pdf', 300],
      ['a traversal key', `payment-proofs/${invoiceId}/../secret.pdf`, 300],
      ['a zero expiry', storedKey, 0],
      ['an expiry above the maximum', storedKey, 901],
    ])('rejects %s', async (_description, key, expiresInSeconds) => {
      await expect(service.createReadUrl(key, expiresInSeconds)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('presigns only a validated private proof key', async () => {
      jest.mocked(getSignedUrl).mockResolvedValue('https://signed.example/proof');

      await expect(service.createReadUrl(storedKey, 120)).resolves.toBe(
        'https://signed.example/proof',
      );

      expect(getSignedUrl).toHaveBeenCalledTimes(1);
      const [, command, options] = jest.mocked(getSignedUrl).mock.calls[0] ?? [];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect((command as GetObjectCommand).input).toEqual({
        Bucket: bucket,
        Key: storedKey,
        ResponseContentDisposition: 'attachment',
      });
      expect(options).toEqual({ expiresIn: 120 });
    });

    it('uses the dedicated presign client and the five-minute default expiry', async () => {
      const presignClient = { send: jest.fn() } as unknown as S3Client;
      service = new StorageService(client, config, presignClient);
      jest.mocked(getSignedUrl).mockResolvedValue('https://signed.example/default-expiry');

      await expect(service.createReadUrl(storedKey)).resolves.toBe(
        'https://signed.example/default-expiry',
      );

      const [usedClient, , options] = jest.mocked(getSignedUrl).mock.calls[0] ?? [];
      expect(usedClient).toBe(presignClient);
      expect(options).toEqual({ expiresIn: 300 });
    });
  });

  describe('bucket lifecycle', () => {
    it('skips object-storage probes in the unit-test environment', async () => {
      configGet.mockImplementation((key: string, fallback?: unknown) =>
        key === 'NODE_ENV' ? 'test' : fallback,
      );

      await service.onModuleInit();

      expect(send).not.toHaveBeenCalled();
    });

    it('auto-creates the bucket outside production when configured', async () => {
      configGet.mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'MINIO_AUTO_CREATE_BUCKET') return true;
        return fallback;
      });
      send.mockResolvedValue({});

      await service.onModuleInit();

      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
    });

    it('probes encrypted write and delete capability during production startup', async () => {
      send.mockResolvedValue({});
      configGet.mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'MINIO_AUTO_CREATE_BUCKET') return false;
        return fallback;
      });

      await service.onModuleInit();

      expect(send).toHaveBeenCalledTimes(3);
      expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
      const put = send.mock.calls[1]?.[0] as PutObjectCommand;
      expect(put).toBeInstanceOf(PutObjectCommand);
      expect(put.input).toMatchObject({
        Bucket: bucket,
        ContentType: 'text/plain',
        ContentLength: 2,
        ServerSideEncryption: 'AES256',
      });
      expect(put.input.Key).toMatch(/^_health\/sse-write-probe\/[0-9a-f-]{36}$/i);
      const remove = send.mock.calls[2]?.[0] as DeleteObjectCommand;
      expect(remove).toBeInstanceOf(DeleteObjectCommand);
      expect(remove.input).toEqual({ Bucket: bucket, Key: put.input.Key });
    });

    it('does nothing when the bucket already exists', async () => {
      send.mockResolvedValue({});

      await service.ensureBucket();

      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
    });

    it('creates the bucket only after a 404', async () => {
      send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } }).mockResolvedValueOnce({});

      await service.ensureBucket();

      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
      expect(send.mock.calls[1]?.[0]).toBeInstanceOf(CreateBucketCommand);
      expect((send.mock.calls[1]?.[0] as CreateBucketCommand).input).toEqual({
        Bucket: bucket,
      });
    });

    it('does not turn an availability or authorization error into bucket creation', async () => {
      const unavailable = { $metadata: { httpStatusCode: 503 } };
      send.mockRejectedValue(unavailable);

      await expect(service.ensureBucket()).rejects.toBe(unavailable);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('accepts a 409 caused by another instance winning the creation race', async () => {
      send
        .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
        .mockRejectedValueOnce({ $metadata: { httpStatusCode: 409 } });

      await expect(service.ensureBucket()).resolves.toBeUndefined();
      expect(send).toHaveBeenCalledTimes(2);
    });

    it('propagates a non-conflict bucket creation failure', async () => {
      const forbidden = { $metadata: { httpStatusCode: 403 } };
      send
        .mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
        .mockRejectedValueOnce(forbidden);

      await expect(service.ensureBucket()).rejects.toBe(forbidden);
    });

    it.each([
      ['a primitive provider error', 'storage offline'],
      ['an error without response metadata', {}],
      ['an error with a non-numeric status', { $metadata: { httpStatusCode: '404' } }],
    ])('does not misclassify %s as a missing bucket', async (_description, providerError) => {
      send.mockRejectedValue(providerError);

      await expect(service.ensureBucket()).rejects.toBe(providerError);
      expect(send).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteObject', () => {
    it('deletes a validated payment-proof key', async () => {
      send.mockResolvedValue({});

      await service.deleteObject(storedKey);

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0]?.[0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect((command as DeleteObjectCommand).input).toEqual({
        Bucket: bucket,
        Key: storedKey,
      });
    });

    it('does not send a delete command for an untrusted key', async () => {
      await service.deleteObject('../../another-bucket/secret');

      expect(send).not.toHaveBeenCalled();
    });
  });
});
