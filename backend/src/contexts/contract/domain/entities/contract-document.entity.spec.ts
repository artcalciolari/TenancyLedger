import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { ContractDocument, ContractDocumentKind } from './contract-document.entity';

const CONTRACT_ID = '4d4d05b6-b5db-47c7-91fc-b0c86c036d9f';
const USER_ID = '957a3866-f282-48d7-9180-5cbf99c74982';

describe('ContractDocument', () => {
  it('creates a normalized append-only document version', () => {
    const document = ContractDocument.create(
      CONTRACT_ID,
      ContractDocumentKind.SIGNED,
      2,
      USER_ID,
      '  contrato   assinado.pdf  ',
      ' Application/PDF ',
    );

    expect(document).toMatchObject({
      contractId: CONTRACT_ID,
      kind: ContractDocumentKind.SIGNED,
      version: 2,
      storageKey: '',
      originalName: 'contrato assinado.pdf',
      contentType: 'application/pdf',
      uploadedByUserId: USER_ID,
    });
    expect(document.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it.each([
    ['contract', 'invalid', USER_ID],
    ['user', CONTRACT_ID, 'invalid'],
  ])('rejects an invalid %s UUID', (_scenario, contractId, userId) => {
    expect(() =>
      ContractDocument.create(
        contractId,
        ContractDocumentKind.SIGNED,
        1,
        userId,
        'signed.pdf',
        'application/pdf',
      ),
    ).toThrow(ValidationError);
  });

  it('rejects invalid kind, version and metadata', () => {
    const create = (
      kind: ContractDocumentKind,
      version: number,
      name = 'signed.pdf',
      contentType = 'application/pdf',
    ): ContractDocument =>
      ContractDocument.create(CONTRACT_ID, kind, version, USER_ID, name, contentType);

    expect(() => create('INVALID' as ContractDocumentKind, 1)).toThrow(ValidationError);
    expect(() => create(ContractDocumentKind.SIGNED, 0)).toThrow(ValidationError);
    expect(() => create(ContractDocumentKind.SIGNED, 1.5)).toThrow(ValidationError);
    expect(() => create(ContractDocumentKind.SIGNED, 1, '')).toThrow(ValidationError);
    expect(() => create(ContractDocumentKind.SIGNED, 1, 'x'.repeat(256))).toThrow(ValidationError);
    expect(() => create(ContractDocumentKind.SIGNED, 1, 'signed.pdf', '')).toThrow(ValidationError);
    expect(() => create(ContractDocumentKind.SIGNED, 1, 'signed.pdf', 'x'.repeat(101))).toThrow(
      ValidationError,
    );
  });

  it('accepts only storage keys scoped to its own document id', () => {
    const document = ContractDocument.create(
      CONTRACT_ID,
      ContractDocumentKind.OTHER,
      1,
      USER_ID,
      'vistoria.png',
      'image/png',
    );
    const key = `documents/contract-documents/${document.id}/asset.png`;

    document.setStorageKey(key);
    expect(document.storageKey).toBe(key);
    expect(() => document.setStorageKey('documents/contract-documents/other/asset.png')).toThrow(
      ValidationError,
    );
  });
});
