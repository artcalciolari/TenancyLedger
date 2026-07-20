import { NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import type { StorageService } from '../../../infrastructure/storage.service';
import {
  OnboardingDraft,
  OnboardingDraftNotEditableError,
  OnboardingDraftStatus,
} from '../domain/onboarding-draft.entity';
import { OnboardingDraftService } from './onboarding-draft.service';

const DRAFT_PHOTO_KEY = `documents/onboarding-draft-photos/${'dad91a88-583f-4b2a-9ac6-0d8eb14cd266'}/9f8b2b8e-1c2b-4a2b-9c2b-1a2b3c4d5e6f.jpg`;

const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';
const OTHER_USER_ID = 'e5c1163a-8151-41e3-b953-350cb36435b1';
const DRAFT_ID = 'dad91a88-583f-4b2a-9ac6-0d8eb14cd266';

function draft(ownerId = USER_ID): OnboardingDraft {
  return Object.assign(OnboardingDraft.create({ step: 2 }, ownerId), {
    id: DRAFT_ID,
    createdAt: new Date('2026-07-18T10:00:00.000Z'),
    updatedAt: new Date('2026-07-18T11:00:00.000Z'),
  });
}

describe('OnboardingDraftService', () => {
  let repository: jest.Mocked<Repository<OnboardingDraft>>;
  let findOne: jest.Mock;
  let save: jest.Mock;
  let transaction: jest.Mock;
  let uploadDocument: jest.Mock;
  let deleteObject: jest.Mock;
  let createDocumentReadUrl: jest.Mock;
  let storage: StorageService;
  let service: OnboardingDraftService;

  beforeEach(() => {
    findOne = jest.fn();
    save = jest.fn((entry: OnboardingDraft) => Promise.resolve(entry));
    const manager = {
      getRepository: jest.fn(() => ({ findOne })),
      save,
    } as unknown as EntityManager;
    transaction = jest.fn((operation: (value: EntityManager) => Promise<unknown>) =>
      operation(manager),
    );
    repository = {
      save,
      findAndCount: jest.fn(),
      findOne,
      manager: { transaction },
    } as unknown as jest.Mocked<Repository<OnboardingDraft>>;
    uploadDocument = jest.fn().mockResolvedValue({ bucket: 'bucket', key: DRAFT_PHOTO_KEY });
    deleteObject = jest.fn().mockResolvedValue(undefined);
    createDocumentReadUrl = jest.fn().mockResolvedValue('https://storage.example.test/signed');
    storage = {
      uploadDocument,
      deleteObject,
      createDocumentReadUrl,
    } as unknown as StorageService;
    service = new OnboardingDraftService(repository, storage);
  });

  it('creates a draft owned by the authenticated user', async () => {
    const result = await service.create({ step: 1 }, USER_ID);
    expect(result).toMatchObject({
      payload: { step: 1 },
      createdByUserId: USER_ID,
      status: OnboardingDraftStatus.DRAFT,
    });
    expect(repository.save.mock.calls).toContainEqual([result]);
  });

  it('lists only the current user drafts for non-admin users', async () => {
    repository.findAndCount.mockResolvedValue([[draft()], 21]);

    await expect(
      service.list(USER_ID, false, { page: 2, limit: 10, status: OnboardingDraftStatus.DRAFT }),
    ).resolves.toMatchObject({
      data: [{ id: DRAFT_ID }],
      meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
    expect(repository.findAndCount.mock.calls).toContainEqual([
      {
        where: { createdByUserId: USER_ID, status: OnboardingDraftStatus.DRAFT },
        order: { updatedAt: 'DESC', id: 'ASC' },
        skip: 10,
        take: 10,
      },
    ]);
  });

  it('allows an admin to list all owners without a status filter', async () => {
    repository.findAndCount.mockResolvedValue([[draft(OTHER_USER_ID)], 1]);

    await service.list(USER_ID, true, { page: 1, limit: 20 });

    expect(repository.findAndCount.mock.calls).toContainEqual([
      {
        where: {},
        order: { updatedAt: 'DESC', id: 'ASC' },
        skip: 0,
        take: 20,
      },
    ]);
  });

  it('gets only a draft owned by a non-admin user', async () => {
    const current = draft();
    repository.findOne.mockResolvedValue(current);
    await expect(service.get(DRAFT_ID, USER_ID, false)).resolves.toBe(current);
    expect(repository.findOne.mock.calls).toContainEqual([
      { where: { id: DRAFT_ID, createdByUserId: USER_ID } },
    ]);
  });

  it('lets an admin access a draft from any owner', async () => {
    const current = draft(OTHER_USER_ID);
    repository.findOne.mockResolvedValue(current);
    await expect(service.get(DRAFT_ID, USER_ID, true)).resolves.toBe(current);
    expect(repository.findOne.mock.calls).toContainEqual([{ where: { id: DRAFT_ID } }]);
  });

  it('returns not found for a missing or inaccessible draft', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.get(DRAFT_ID, USER_ID, false)).rejects.toEqual(
      new NotFoundException('Rascunho de onboarding não encontrado.'),
    );
  });

  it('updates an accessible draft payload', async () => {
    const current = draft();
    repository.findOne.mockResolvedValue(current);
    const result = await service.update(DRAFT_ID, { step: 4 }, USER_ID, false);
    expect(result.payload).toEqual({ step: 4 });
    expect(save.mock.calls).toContainEqual([current]);
    expect(findOne.mock.calls).toContainEqual([
      {
        where: { id: DRAFT_ID, createdByUserId: USER_ID },
        lock: { mode: 'pessimistic_write' },
      },
    ]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('soft-deletes an accessible draft as discarded', async () => {
    const current = draft();
    repository.findOne.mockResolvedValue(current);
    await service.discard(DRAFT_ID, USER_ID, false);
    expect(current.status).toBe(OnboardingDraftStatus.DISCARDED);
    expect(save.mock.calls).toContainEqual([current]);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('removes the temporary photo object when discarding a draft that has one', async () => {
    const current = draft();
    current.setPhotoStorageKey(DRAFT_PHOTO_KEY);
    repository.findOne.mockResolvedValue(current);

    await service.discard(DRAFT_ID, USER_ID, false);

    expect(current.status).toBe(OnboardingDraftStatus.DISCARDED);
    expect(current.photoStorageKey).toBeNull();
    expect(deleteObject).toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('keeps the discard successful even if removing the temporary photo object fails', async () => {
    const current = draft();
    current.setPhotoStorageKey(DRAFT_PHOTO_KEY);
    repository.findOne.mockResolvedValue(current);
    deleteObject.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(service.discard(DRAFT_ID, USER_ID, false)).resolves.toBeUndefined();

    expect(current.status).toBe(OnboardingDraftStatus.DISCARDED);
    expect(deleteObject).toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('uploads a photo, associates it with the draft, and cleans up the previous object', async () => {
    const current = draft();
    current.setPhotoStorageKey(
      `documents/onboarding-draft-photos/${DRAFT_ID}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`,
    );
    const previousKey = current.photoStorageKey;
    repository.findOne.mockResolvedValue(current);

    const result = await service.uploadPhoto(DRAFT_ID, USER_ID, false, {
      contentType: 'image/jpeg',
      body: Buffer.from('photo'),
    });

    expect(uploadDocument).toHaveBeenCalledWith({
      folder: 'onboarding-draft-photos',
      ownerId: DRAFT_ID,
      contentType: 'image/jpeg',
      body: Buffer.from('photo'),
    });
    expect(result.photoStorageKey).toBe(DRAFT_PHOTO_KEY);
    expect(deleteObject).toHaveBeenCalledWith(previousKey);
  });

  it('keeps the upload successful even if cleaning up the previous photo object fails', async () => {
    const current = draft();
    current.setPhotoStorageKey(
      `documents/onboarding-draft-photos/${DRAFT_ID}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png`,
    );
    const previousKey = current.photoStorageKey;
    repository.findOne.mockResolvedValue(current);
    deleteObject.mockRejectedValueOnce(new Error('storage unavailable'));

    const result = await service.uploadPhoto(DRAFT_ID, USER_ID, false, {
      contentType: 'image/jpeg',
      body: Buffer.from('photo'),
    });

    expect(result.photoStorageKey).toBe(DRAFT_PHOTO_KEY);
    expect(deleteObject).toHaveBeenCalledWith(previousKey);
  });

  it('removes the uploaded object if persisting the draft photo reference fails', async () => {
    const completed = draft();
    completed.markCompleted();
    findOne.mockResolvedValue(completed);

    await expect(
      service.uploadPhoto(DRAFT_ID, USER_ID, false, {
        contentType: 'image/jpeg',
        body: Buffer.from('photo'),
      }),
    ).rejects.toBeInstanceOf(OnboardingDraftNotEditableError);
    expect(deleteObject).toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('preserves the original error even if orphan cleanup fails after a failed photo upload', async () => {
    const completed = draft();
    completed.markCompleted();
    findOne.mockResolvedValue(completed);
    deleteObject.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      service.uploadPhoto(DRAFT_ID, USER_ID, false, {
        contentType: 'image/jpeg',
        body: Buffer.from('photo'),
      }),
    ).rejects.toBeInstanceOf(OnboardingDraftNotEditableError);
    expect(deleteObject).toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('removes an associated photo from a draft', async () => {
    const current = draft();
    current.setPhotoStorageKey(DRAFT_PHOTO_KEY);
    repository.findOne.mockResolvedValue(current);

    const result = await service.removePhoto(DRAFT_ID, USER_ID, false);

    expect(result.photoStorageKey).toBeNull();
    expect(deleteObject).toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('keeps the removal successful even if deleting the photo object fails', async () => {
    const current = draft();
    current.setPhotoStorageKey(DRAFT_PHOTO_KEY);
    repository.findOne.mockResolvedValue(current);
    deleteObject.mockRejectedValueOnce(new Error('storage unavailable'));

    const result = await service.removePhoto(DRAFT_ID, USER_ID, false);

    expect(result.photoStorageKey).toBeNull();
    expect(deleteObject).toHaveBeenCalledWith(DRAFT_PHOTO_KEY);
  });

  it('does nothing when removing a photo from a draft that has none', async () => {
    const current = draft();
    repository.findOne.mockResolvedValue(current);

    await service.removePhoto(DRAFT_ID, USER_ID, false);

    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('returns a signed download URL for an accessible draft photo', async () => {
    const current = draft();
    current.setPhotoStorageKey(DRAFT_PHOTO_KEY);
    repository.findOne.mockResolvedValue(current);

    await expect(service.getPhotoDownloadUrl(DRAFT_ID, USER_ID, false)).resolves.toEqual({
      url: 'https://storage.example.test/signed',
      expiresInSeconds: 300,
    });
    expect(createDocumentReadUrl).toHaveBeenCalledWith(DRAFT_PHOTO_KEY, 300);
  });

  it('rejects a photo download for a draft without an associated photo', async () => {
    const current = draft();
    repository.findOne.mockResolvedValue(current);

    await expect(service.getPhotoDownloadUrl(DRAFT_ID, USER_ID, false)).rejects.toEqual(
      new NotFoundException('O rascunho não possui foto cadastrada.'),
    );
  });

  it('cannot overwrite a draft completed while an update was waiting for its lock', async () => {
    const completed = draft();
    completed.markCompleted();
    findOne.mockResolvedValue(completed);

    await expect(service.update(DRAFT_ID, { step: 5 }, USER_ID, false)).rejects.toBeInstanceOf(
      OnboardingDraftNotEditableError,
    );
    expect(save).not.toHaveBeenCalled();
    expect(completed.status).toBe(OnboardingDraftStatus.COMPLETED);
  });

  it('cannot discard a draft completed while deletion was waiting for its lock', async () => {
    const completed = draft();
    completed.markCompleted();
    findOne.mockResolvedValue(completed);

    await expect(service.discard(DRAFT_ID, USER_ID, false)).rejects.toBeInstanceOf(
      OnboardingDraftNotEditableError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('returns not found from a locked admin mutation when the draft is inaccessible', async () => {
    findOne.mockResolvedValue(null);

    await expect(service.update(DRAFT_ID, { step: 4 }, USER_ID, true)).rejects.toEqual(
      new NotFoundException('Rascunho de onboarding não encontrado.'),
    );
    expect(findOne.mock.calls).toContainEqual([
      {
        where: { id: DRAFT_ID },
        lock: { mode: 'pessimistic_write' },
      },
    ]);
  });
});
