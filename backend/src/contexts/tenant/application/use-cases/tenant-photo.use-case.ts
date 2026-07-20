import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StorageService } from '../../../../infrastructure/storage.service';
import {
  TENANT_REPOSITORY_TOKEN,
  type ITenantRepository,
} from '../../domain/repositories/tenant.repository';

export interface TenantPhotoUpload {
  contentType: string;
  body: Buffer;
}

@Injectable()
export class TenantPhotoUseCase {
  private readonly logger = new Logger(TenantPhotoUseCase.name);

  constructor(
    @Inject(TENANT_REPOSITORY_TOKEN)
    private readonly tenants: ITenantRepository,
    private readonly storage: StorageService,
  ) {}

  async upload(tenantId: string, photo: TenantPhotoUpload): Promise<void> {
    const tenant = await this.tenants.findById(tenantId);
    if (!tenant) throw new NotFoundException('Locatário não encontrado.');

    const previousKey = tenant.photoStorageKey;
    const stored = await this.storage.uploadDocument({
      folder: 'tenant-photos',
      ownerId: tenantId,
      contentType: photo.contentType,
      body: photo.body,
    });
    try {
      tenant.setPhotoStorageKey(stored.key);
      await this.tenants.save(tenant);
    } catch (error: unknown) {
      await this.storage.deleteObject(stored.key).catch((cleanupError: unknown) => {
        this.logger.error('Não foi possível remover uma foto órfã de locatário.', cleanupError);
      });
      throw error;
    }

    if (previousKey && previousKey !== stored.key) {
      await this.storage.deleteObject(previousKey).catch((error: unknown) => {
        this.logger.warn('Não foi possível remover a versão anterior da foto do locatário.', error);
      });
    }
  }

  async getDownloadUrl(tenantId: string): Promise<{ url: string; expiresInSeconds: number }> {
    const tenant = await this.tenants.findById(tenantId);
    if (!tenant) throw new NotFoundException('Locatário não encontrado.');
    if (!tenant.photoStorageKey) {
      throw new NotFoundException('O locatário não possui foto cadastrada.');
    }

    const expiresInSeconds = 300;
    return {
      url: await this.storage.createDocumentReadUrl(tenant.photoStorageKey, expiresInSeconds),
      expiresInSeconds,
    };
  }
}
