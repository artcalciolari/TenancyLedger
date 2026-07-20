import { NotFoundException } from '@nestjs/common';
import { StorageService } from '../../../../infrastructure/storage.service';
import { Tenant, TenantCivilStatus } from '../../domain/entities/tenant.entity';
import type { ITenantRepository } from '../../domain/repositories/tenant.repository';
import { TenantPhotoUseCase } from './tenant-photo.use-case';

const TENANT_ID = '9465500e-0a06-452a-b1a8-9a3b117f3af0';
const NEW_KEY =
  'documents/tenant-photos/9465500e-0a06-452a-b1a8-9a3b117f3af0/123e4567-e89b-42d3-a456-426614174000.jpg';
const OLD_KEY =
  'documents/tenant-photos/9465500e-0a06-452a-b1a8-9a3b117f3af0/223e4567-e89b-42d3-a456-426614174000.png';

function tenant(): Tenant {
  return Object.assign(
    Tenant.create(
      'Maria da Silva',
      '52998224725',
      '123456789',
      'Engenheira',
      TenantCivilStatus.SINGLE,
      'maria@example.com',
      '11987654321',
    ),
    { id: TENANT_ID },
  );
}

describe('TenantPhotoUseCase', () => {
  let tenants: jest.Mocked<ITenantRepository>;
  let storage: jest.Mocked<StorageService>;
  let useCase: TenantPhotoUseCase;

  beforeEach(() => {
    tenants = {
      findById: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ITenantRepository>;
    storage = {
      uploadDocument: jest.fn().mockResolvedValue({ bucket: 'private', key: NEW_KEY }),
      deleteObject: jest.fn().mockResolvedValue(undefined),
      createDocumentReadUrl: jest.fn().mockResolvedValue('https://signed.example/photo'),
    } as unknown as jest.Mocked<StorageService>;
    useCase = new TenantPhotoUseCase(tenants, storage);
  });

  it('uploads a validated private photo and persists its key', async () => {
    const current = tenant();
    tenants.findById.mockResolvedValue(current);
    const body = Buffer.from([0xff, 0xd8, 0xff]);

    await useCase.upload(TENANT_ID, { contentType: 'image/jpeg', body });

    expect(storage.uploadDocument.mock.calls).toContainEqual([
      {
        folder: 'tenant-photos',
        ownerId: TENANT_ID,
        contentType: 'image/jpeg',
        body,
      },
    ]);
    expect(current.photoStorageKey).toBe(NEW_KEY);
    expect(tenants.save.mock.calls).toContainEqual([current]);
    expect(storage.deleteObject.mock.calls).toHaveLength(0);
  });

  it('removes the previous object after replacing a photo', async () => {
    const current = tenant();
    current.setPhotoStorageKey(OLD_KEY);
    tenants.findById.mockResolvedValue(current);

    await useCase.upload(TENANT_ID, {
      contentType: 'image/jpeg',
      body: Buffer.from([0xff, 0xd8, 0xff]),
    });

    expect(storage.deleteObject.mock.calls).toContainEqual([OLD_KEY]);
  });

  it('keeps the successful replacement when cleanup of the previous object fails', async () => {
    const current = tenant();
    current.setPhotoStorageKey(OLD_KEY);
    tenants.findById.mockResolvedValue(current);
    storage.deleteObject.mockRejectedValue('storage unavailable');

    await expect(
      useCase.upload(TENANT_ID, {
        contentType: 'image/jpeg',
        body: Buffer.from([0xff, 0xd8, 0xff]),
      }),
    ).resolves.toBeUndefined();
  });

  it('removes the new object and preserves the persistence error', async () => {
    tenants.findById.mockResolvedValue(tenant());
    const persistenceError = new Error('database unavailable');
    tenants.save.mockRejectedValue(persistenceError);

    await expect(
      useCase.upload(TENANT_ID, {
        contentType: 'image/jpeg',
        body: Buffer.from([0xff, 0xd8, 0xff]),
      }),
    ).rejects.toBe(persistenceError);
    expect(storage.deleteObject.mock.calls).toContainEqual([NEW_KEY]);
  });

  it('preserves the persistence error when orphan cleanup also fails', async () => {
    tenants.findById.mockResolvedValue(tenant());
    tenants.save.mockRejectedValue('database unavailable');
    storage.deleteObject.mockRejectedValue(new Error('storage unavailable'));

    await expect(
      useCase.upload(TENANT_ID, {
        contentType: 'image/jpeg',
        body: Buffer.from([0xff, 0xd8, 0xff]),
      }),
    ).rejects.toBe('database unavailable');
  });

  it('rejects an upload for an unknown tenant before storing bytes', async () => {
    tenants.findById.mockResolvedValue(null);

    await expect(
      useCase.upload(TENANT_ID, { contentType: 'image/jpeg', body: Buffer.from('photo') }),
    ).rejects.toEqual(new NotFoundException('Locatário não encontrado.'));
    expect(storage.uploadDocument.mock.calls).toHaveLength(0);
  });

  it('returns a five-minute URL for the current private photo', async () => {
    const current = tenant();
    current.setPhotoStorageKey(NEW_KEY);
    tenants.findById.mockResolvedValue(current);

    await expect(useCase.getDownloadUrl(TENANT_ID)).resolves.toEqual({
      url: 'https://signed.example/photo',
      expiresInSeconds: 300,
    });
    expect(storage.createDocumentReadUrl.mock.calls).toContainEqual([NEW_KEY, 300]);
  });

  it.each([
    ['unknown tenant', null, 'Locatário não encontrado.'],
    ['tenant without photo', tenant(), 'O locatário não possui foto cadastrada.'],
  ])('does not issue a URL for an %s', async (_label, current, message) => {
    tenants.findById.mockResolvedValue(current);
    await expect(useCase.getDownloadUrl(TENANT_ID)).rejects.toEqual(new NotFoundException(message));
    expect(storage.createDocumentReadUrl.mock.calls).toHaveLength(0);
  });
});
