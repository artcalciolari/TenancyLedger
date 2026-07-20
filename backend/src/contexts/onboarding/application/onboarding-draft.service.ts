import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository, type EntityManager } from 'typeorm';
import { StorageService } from '../../../infrastructure/storage.service';
import { OnboardingDraft, OnboardingDraftStatus } from '../domain/onboarding-draft.entity';

export interface ListOnboardingDraftsInput {
  page: number;
  limit: number;
  status?: OnboardingDraftStatus;
}

export interface PaginatedOnboardingDrafts {
  data: OnboardingDraft[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface OnboardingDraftPhotoUpload {
  contentType: string;
  body: Buffer;
}

@Injectable()
export class OnboardingDraftService {
  private readonly logger = new Logger(OnboardingDraftService.name);

  constructor(
    @InjectRepository(OnboardingDraft)
    private readonly drafts: Repository<OnboardingDraft>,
    private readonly storage: StorageService,
  ) {}

  create(payload: unknown, createdByUserId: string): Promise<OnboardingDraft> {
    return this.drafts.save(OnboardingDraft.create(payload, createdByUserId));
  }

  async list(
    actorId: string,
    isAdmin: boolean,
    input: ListOnboardingDraftsInput,
  ): Promise<PaginatedOnboardingDrafts> {
    const where: FindOptionsWhere<OnboardingDraft> = {
      ...(isAdmin ? {} : { createdByUserId: actorId }),
      ...(input.status ? { status: input.status } : {}),
    };
    const [data, total] = await this.drafts.findAndCount({
      where,
      order: { updatedAt: 'DESC', id: 'ASC' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    });
    return {
      data,
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  get(id: string, actorId: string, isAdmin: boolean): Promise<OnboardingDraft> {
    return this.findAccessible(id, actorId, isAdmin);
  }

  async update(
    id: string,
    payload: unknown,
    actorId: string,
    isAdmin: boolean,
  ): Promise<OnboardingDraft> {
    return this.mutateLocked(id, actorId, isAdmin, (draft) => {
      draft.updatePayload(payload);
      return draft;
    });
  }

  async discard(id: string, actorId: string, isAdmin: boolean): Promise<void> {
    const removedPhotoKey = await this.mutateLocked(id, actorId, isAdmin, (draft) => {
      const photoKey = draft.photoStorageKey;
      draft.discard();
      return photoKey;
    });
    if (removedPhotoKey) {
      await this.storage.deleteObject(removedPhotoKey).catch((error: unknown) => {
        this.logger.warn(
          'Não foi possível remover a foto temporária do rascunho descartado.',
          error,
        );
      });
    }
  }

  async uploadPhoto(
    id: string,
    actorId: string,
    isAdmin: boolean,
    photo: OnboardingDraftPhotoUpload,
  ): Promise<OnboardingDraft> {
    const stored = await this.storage.uploadDocument({
      folder: 'onboarding-draft-photos',
      ownerId: id,
      contentType: photo.contentType,
      body: photo.body,
    });
    try {
      let previousKey: string | null = null;
      const draft = await this.mutateLocked(id, actorId, isAdmin, (current) => {
        previousKey = current.photoStorageKey;
        current.setPhotoStorageKey(stored.key);
        return current;
      });
      if (previousKey && previousKey !== stored.key) {
        await this.storage.deleteObject(previousKey).catch((error: unknown) => {
          this.logger.warn(
            'Não foi possível remover a foto temporária anterior do rascunho.',
            error,
          );
        });
      }
      return draft;
    } catch (error: unknown) {
      await this.storage.deleteObject(stored.key).catch((cleanupError: unknown) => {
        this.logger.error(
          'Não foi possível remover uma foto órfã do rascunho de onboarding.',
          cleanupError,
        );
      });
      throw error;
    }
  }

  async removePhoto(id: string, actorId: string, isAdmin: boolean): Promise<OnboardingDraft> {
    let removedKey: string | null = null;
    const draft = await this.mutateLocked(id, actorId, isAdmin, (current) => {
      removedKey = current.photoStorageKey;
      current.clearPhotoStorageKey();
      return current;
    });
    if (removedKey) {
      await this.storage.deleteObject(removedKey).catch((error: unknown) => {
        this.logger.warn('Não foi possível remover a foto temporária do rascunho.', error);
      });
    }
    return draft;
  }

  async getPhotoDownloadUrl(
    id: string,
    actorId: string,
    isAdmin: boolean,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const draft = await this.findAccessible(id, actorId, isAdmin);
    if (!draft.photoStorageKey) {
      throw new NotFoundException('O rascunho não possui foto cadastrada.');
    }
    const expiresInSeconds = 300;
    return {
      url: await this.storage.createDocumentReadUrl(draft.photoStorageKey, expiresInSeconds),
      expiresInSeconds,
    };
  }

  private async findAccessible(
    id: string,
    actorId: string,
    isAdmin: boolean,
  ): Promise<OnboardingDraft> {
    const draft = await this.drafts.findOne({
      where: isAdmin ? { id } : { id, createdByUserId: actorId },
    });
    if (!draft) throw new NotFoundException('Rascunho de onboarding não encontrado.');
    return draft;
  }

  private mutateLocked<T>(
    id: string,
    actorId: string,
    isAdmin: boolean,
    change: (draft: OnboardingDraft) => T,
  ): Promise<T> {
    return this.drafts.manager.transaction(async (manager) => {
      const draft = await this.findAccessibleForUpdate(manager, id, actorId, isAdmin);
      const result = change(draft);
      await manager.save(draft);
      return result;
    });
  }

  private async findAccessibleForUpdate(
    manager: EntityManager,
    id: string,
    actorId: string,
    isAdmin: boolean,
  ): Promise<OnboardingDraft> {
    const draft = await manager.getRepository(OnboardingDraft).findOne({
      where: isAdmin ? { id } : { id, createdByUserId: actorId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!draft) throw new NotFoundException('Rascunho de onboarding não encontrado.');
    return draft;
  }
}
