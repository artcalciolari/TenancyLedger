import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { TenantReference, type TenantReferenceFields } from './tenant-reference.entity';

const TENANT_ID = '9465500e-0a06-452a-b1a8-9a3b117f3af0';
const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';
const BASE_FIELDS: TenantReferenceFields = {
  name: 'João da Silva',
  relationship: 'Irmão',
  phone: '11987654321',
  email: 'joao@example.com',
  notes: 'Contato preferencial no período da manhã.',
};

describe('TenantReference', () => {
  it('normalizes contact fields and starts unverified', () => {
    const reference = TenantReference.create(TENANT_ID, {
      name: '  João   da Silva ',
      relationship: '  Amigo   próximo ',
      phone: '+55 (11) 98765-4321',
      email: ' JOAO@EXAMPLE.COM ',
      notes: '  Ligar   pela manhã. ',
    });

    expect(reference).toMatchObject({
      tenantId: TENANT_ID,
      name: 'João da Silva',
      relationship: 'Amigo próximo',
      phone: '11987654321',
      email: 'joao@example.com',
      notes: 'Ligar pela manhã.',
      verifiedAt: null,
      verifiedByUserId: null,
    });
  });

  it.each([undefined, null, ''])('normalizes optional empty values (%p) to null', (empty) => {
    const reference = TenantReference.create(TENANT_ID, {
      ...BASE_FIELDS,
      email: empty,
      notes: empty,
    });
    expect(reference.email).toBeNull();
    expect(reference.notes).toBeNull();
  });

  it.each([
    ['short name', { name: 'A' }],
    ['long name', { name: 'N'.repeat(121) }],
    ['short relationship', { relationship: 'A' }],
    ['long relationship', { relationship: 'R'.repeat(81) }],
    ['invalid phone', { phone: '1111' }],
    ['invalid area code', { phone: '00987654321' }],
    ['invalid email', { email: 'invalid.example.com' }],
    ['long email', { email: `${'a'.repeat(250)}@x.com` }],
    ['long notes', { notes: 'N'.repeat(1001) }],
  ] satisfies Array<[string, Partial<TenantReferenceFields>]>)('rejects a %s', (_label, fields) => {
    expect(() => TenantReference.create(TENANT_ID, { ...BASE_FIELDS, ...fields })).toThrow(
      ValidationError,
    );
  });

  it('accepts domestic landline numbers', () => {
    expect(
      TenantReference.create(TENANT_ID, { ...BASE_FIELDS, phone: '(11) 3456-7890' }).phone,
    ).toBe('1134567890');
  });

  it('marks a reference as verified with a defensive date copy', () => {
    const reference = TenantReference.create(TENANT_ID, BASE_FIELDS);
    const at = new Date('2026-07-18T14:00:00.000Z');

    reference.markVerified(USER_ID, at);
    at.setUTCFullYear(2030);

    expect(reference.verifiedByUserId).toBe(USER_ID);
    expect(reference.verifiedAt?.toISOString()).toBe('2026-07-18T14:00:00.000Z');
  });

  it.each([
    ['invalid user', 'not-a-uuid', new Date()],
    ['invalid date', USER_ID, new Date('invalid')],
  ])('rejects verification with %s', (_label, userId, date) => {
    const reference = TenantReference.create(TENANT_ID, BASE_FIELDS);
    expect(() => reference.markVerified(userId, date)).toThrow(ValidationError);
  });

  it('clears verification when verified identity or contact data changes', () => {
    const reference = TenantReference.create(TENANT_ID, BASE_FIELDS);
    reference.markVerified(USER_ID, new Date());

    reference.update({ phone: '(11) 3456-7890', email: null });

    expect(reference.phone).toBe('1134567890');
    expect(reference.email).toBeNull();
    expect(reference.verifiedAt).toBeNull();
    expect(reference.verifiedByUserId).toBeNull();
  });

  it('preserves verification when only notes change', () => {
    const reference = TenantReference.create(TENANT_ID, BASE_FIELDS);
    reference.markVerified(USER_ID, new Date('2026-07-18T14:00:00.000Z'));

    reference.update({ notes: '  Nova   observação.  ' });

    expect(reference.notes).toBe('Nova observação.');
    expect(reference.verifiedByUserId).toBe(USER_ID);
  });
});
