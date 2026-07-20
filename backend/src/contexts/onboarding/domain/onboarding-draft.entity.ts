import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConflictError } from '../../../core/domain/errors/conflict.error';
import { ValidationError } from '../../../core/domain/errors/validation.error';

export enum OnboardingDraftStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED',
  DISCARDED = 'DISCARDED',
}

export class OnboardingDraftNotEditableError extends ConflictError {}

const PHOTO_STORAGE_KEY_PATTERN =
  /^documents\/onboarding-draft-photos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|heic|heif)$/i;

@Entity('onboarding_drafts')
@Index('IDX_onboarding_drafts_creator_updated', ['createdByUserId', 'updatedAt', 'id'])
@Check('CHK_onboarding_drafts_payload_size', 'octet_length(payload::text) <= 65536')
export class OnboardingDraft {
  static readonly MAX_PAYLOAD_BYTES = 64 * 1024;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'jsonb' })
  payload!: unknown;

  @Column({ name: 'photo_storage_key', type: 'varchar', length: 500, nullable: true })
  photoStorageKey!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  @ForeignKey('User', {
    name: 'FK_onboarding_drafts_created_by',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  createdByUserId!: string;

  @Column({
    type: 'enum',
    enum: OnboardingDraftStatus,
    enumName: 'onboarding_draft_status',
    default: OnboardingDraftStatus.DRAFT,
  })
  status!: OnboardingDraftStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  static create(payload: unknown, createdByUserId: string): OnboardingDraft {
    const draft = new OnboardingDraft();
    draft.payload = OnboardingDraft.normalizePayload(payload);
    draft.createdByUserId = createdByUserId;
    draft.status = OnboardingDraftStatus.DRAFT;
    draft.photoStorageKey = null;
    return draft;
  }

  updatePayload(payload: unknown): void {
    this.assertDraft();
    this.payload = OnboardingDraft.normalizePayload(payload);
  }

  setPhotoStorageKey(storageKey: string): void {
    this.assertDraft();
    if (!PHOTO_STORAGE_KEY_PATTERN.test(storageKey)) {
      throw new ValidationError('Chave de armazenamento da foto do rascunho inválida.');
    }
    this.photoStorageKey = storageKey;
  }

  clearPhotoStorageKey(): void {
    this.assertDraft();
    this.photoStorageKey = null;
  }

  markCompleted(): void {
    this.assertDraft();
    this.status = OnboardingDraftStatus.COMPLETED;
  }

  discard(): void {
    if (this.status === OnboardingDraftStatus.DISCARDED) return;
    if (this.status === OnboardingDraftStatus.COMPLETED) {
      throw new OnboardingDraftNotEditableError('Um rascunho concluído não pode ser descartado.');
    }
    this.status = OnboardingDraftStatus.DISCARDED;
    this.photoStorageKey = null;
  }

  private assertDraft(): void {
    if (this.status !== OnboardingDraftStatus.DRAFT) {
      throw new OnboardingDraftNotEditableError('O rascunho não está mais editável.');
    }
  }

  private static normalizePayload(payload: unknown): unknown {
    let serialized: string | undefined;
    try {
      serialized = JSON.stringify(payload);
    } catch {
      throw new ValidationError('O payload do rascunho deve ser um JSON válido.');
    }
    if (serialized === undefined) {
      throw new ValidationError('O payload do rascunho deve ser um JSON válido.');
    }
    if (Buffer.byteLength(serialized, 'utf8') > OnboardingDraft.MAX_PAYLOAD_BYTES) {
      throw new ValidationError('O payload do rascunho deve ter no máximo 64 KiB.');
    }
    return JSON.parse(serialized) as unknown;
  }
}
