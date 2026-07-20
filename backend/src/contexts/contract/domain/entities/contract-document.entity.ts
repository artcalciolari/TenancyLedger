import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../../../core/domain/errors/validation.error';

export enum ContractDocumentKind {
  GENERATED = 'GENERATED',
  SIGNED = 'SIGNED',
  OTHER = 'OTHER',
}

@Entity('contract_documents')
@Unique('UQ_contract_documents_kind_version', ['contractId', 'kind', 'version'])
@Index('IDX_contract_documents_contract_created', ['contractId', 'createdAt', 'id'])
@Check('CHK_contract_documents_version', 'version > 0')
@Check('CHK_contract_documents_original_name', 'char_length(trim(original_name)) BETWEEN 1 AND 255')
export class ContractDocument {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ name: 'contract_id', type: 'uuid' })
  @ForeignKey('Contract', {
    name: 'FK_contract_documents_contract',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  contractId!: string;

  @Column({ type: 'enum', enum: ContractDocumentKind, enumName: 'contract_document_kind' })
  kind!: ContractDocumentKind;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ name: 'storage_key', type: 'varchar', length: 500 })
  storageKey!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 100 })
  contentType!: string;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  @ForeignKey('User', {
    name: 'FK_contract_documents_uploaded_by',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  })
  uploadedByUserId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  static create(
    contractId: string,
    kind: ContractDocumentKind,
    version: number,
    uploadedByUserId: string,
    originalName: string,
    contentType: string,
  ): ContractDocument {
    ContractDocument.assertUuid(contractId, 'contrato');
    ContractDocument.assertUuid(uploadedByUserId, 'usuário');
    if (!Object.values(ContractDocumentKind).includes(kind)) {
      throw new ValidationError('O tipo do documento do contrato é inválido.');
    }
    if (!Number.isInteger(version) || version <= 0) {
      throw new ValidationError('A versão do documento deve ser um inteiro positivo.');
    }
    const normalizedName = originalName.trim().replace(/\s+/g, ' ');
    if (!normalizedName || normalizedName.length > 255) {
      throw new ValidationError('O nome do documento deve conter entre 1 e 255 caracteres.');
    }
    const normalizedContentType = contentType.trim().toLowerCase();
    if (!normalizedContentType || normalizedContentType.length > 100) {
      throw new ValidationError('O tipo de conteúdo do documento é inválido.');
    }

    return Object.assign(new ContractDocument(), {
      id: randomUUID(),
      contractId,
      kind,
      version,
      storageKey: '',
      originalName: normalizedName,
      contentType: normalizedContentType,
      uploadedByUserId,
    });
  }

  setStorageKey(storageKey: string): void {
    const expectedPrefix = `documents/contract-documents/${this.id}/`;
    if (!storageKey.startsWith(expectedPrefix)) {
      throw new ValidationError('Chave de armazenamento do documento inválida.');
    }
    this.storageKey = storageKey;
  }

  private static assertUuid(value: string, label: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new ValidationError(`O ID de ${label} deve ser um UUID válido.`);
    }
  }
}
