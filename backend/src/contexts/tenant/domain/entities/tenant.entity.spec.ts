import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Tenant, TenantCivilStatus, type UpdateTenantProfileFields } from './tenant.entity';

interface TenantInput {
  name: string;
  cpf: string;
  rg: string;
  profession: string;
  civilStatus: TenantCivilStatus;
  email: string;
  mobilePhone: string;
}

const BASE_INPUT: TenantInput = {
  name: 'Maria da Silva',
  cpf: '52998224725',
  rg: 'MG-12.345',
  profession: 'Engenheira',
  civilStatus: TenantCivilStatus.SINGLE,
  email: 'maria@example.com',
  mobilePhone: '11987654321',
};

function createTenant(overrides: Partial<TenantInput> = {}): Tenant {
  const input = { ...BASE_INPUT, ...overrides };
  return Tenant.create(
    input.name,
    input.cpf,
    input.rg,
    input.profession,
    input.civilStatus,
    input.email,
    input.mobilePhone,
  );
}

describe('Tenant', () => {
  it('normalizes identity and contact data at creation', () => {
    const tenant = createTenant({
      name: '  Maria   da   Silva  ',
      cpf: '529.982.247-25',
      rg: '  mg-12.345  ',
      profession: '  Engenheira   Civil  ',
      email: '  MARIA@EXAMPLE.COM  ',
      mobilePhone: '+55 (11) 99876-5432',
    });

    expect(tenant).toMatchObject({
      name: 'Maria da Silva',
      cpf: '52998224725',
      rg: 'MG-12.345',
      profession: 'Engenheira Civil',
      civilStatus: TenantCivilStatus.SINGLE,
      email: 'maria@example.com',
      mobilePhone: '11998765432',
    });
  });

  it('accepts documented maximum field lengths', () => {
    const tenant = createTenant({
      name: 'N'.repeat(120),
      rg: '1'.repeat(20),
      profession: 'P'.repeat(100),
      email: `${'a'.repeat(242)}@example.com`,
    });

    expect(tenant.name).toHaveLength(120);
    expect(tenant.rg).toHaveLength(20);
    expect(tenant.profession).toHaveLength(100);
    expect(tenant.email).toHaveLength(254);
  });

  it.each([
    {
      scenario: 'short name',
      create: () => createTenant({ name: ' A ' }),
    },
    {
      scenario: 'long name',
      create: () => createTenant({ name: 'N'.repeat(121) }),
    },
    {
      scenario: 'short RG',
      create: () => createTenant({ rg: '1234' }),
    },
    {
      scenario: 'long RG',
      create: () => createTenant({ rg: '1'.repeat(21) }),
    },
    {
      scenario: 'RG with unsupported characters',
      create: () => createTenant({ rg: '12 345' }),
    },
    {
      scenario: 'short profession',
      create: () => createTenant({ profession: 'A' }),
    },
    {
      scenario: 'long profession',
      create: () => createTenant({ profession: 'P'.repeat(101) }),
    },
    {
      scenario: 'malformed email',
      create: () => createTenant({ email: 'maria.example.com' }),
    },
    {
      scenario: 'long email',
      create: () => createTenant({ email: `${'a'.repeat(250)}@x.com` }),
    },
    {
      scenario: 'unknown civil status',
      create: () => createTenant({ civilStatus: 'SEPARATED' as TenantCivilStatus }),
    },
    {
      scenario: 'invalid CPF',
      create: () => createTenant({ cpf: '11111111111' }),
    },
    {
      scenario: 'invalid mobile phone',
      create: () => createTenant({ mobilePhone: '1134567890' }),
    },
  ])('rejects a $scenario', ({ create }) => {
    expect(create).toThrow(ValidationError);
  });

  it.each([
    ['domestic formatting', '(11) 99876-5432', '11998765432'],
    ['Brazil country code', '+55 11 99876-5432', '11998765432'],
  ])('normalizes %s in mobile numbers', (_scenario, input, expected) => {
    expect(Tenant.normalizeMobilePhone(input)).toBe(expected);
  });

  it.each([
    {
      field: 'name',
      fields: { name: '  Maria   Souza  ' },
      expected: { name: 'Maria Souza' },
    },
    {
      field: 'profession',
      fields: { profession: '  Arquiteta   Urbanista  ' },
      expected: { profession: 'Arquiteta Urbanista' },
    },
    {
      field: 'civil status',
      fields: { civilStatus: TenantCivilStatus.MARRIED },
      expected: { civilStatus: TenantCivilStatus.MARRIED },
    },
    {
      field: 'email',
      fields: { email: '  MARIA.SOUZA@EXAMPLE.COM  ' },
      expected: { email: 'maria.souza@example.com' },
    },
    {
      field: 'mobile phone',
      fields: { mobilePhone: '+55 11 99876-5432' },
      expected: { mobilePhone: '11998765432' },
    },
  ] satisfies Array<{
    field: string;
    fields: UpdateTenantProfileFields;
    expected: UpdateTenantProfileFields;
  }>)('updates and normalizes only the optional $field', ({ fields, expected }) => {
    const tenant = createTenant();

    tenant.updateProfile(fields);

    expect(tenant).toMatchObject({
      ...BASE_INPUT,
      rg: 'MG-12.345',
      ...expected,
    });
  });

  it('preserves the profile atomically when an update is invalid', () => {
    const tenant = createTenant();
    const original = {
      name: tenant.name,
      profession: tenant.profession,
      civilStatus: tenant.civilStatus,
      email: tenant.email,
      mobilePhone: tenant.mobilePhone,
    };

    expect(() =>
      tenant.updateProfile({
        name: 'Maria Souza',
        email: 'invalid-email',
      }),
    ).toThrow(ValidationError);
    expect(tenant).toMatchObject(original);
  });

  it('keeps normalized state stable across repeated profile updates', () => {
    const tenant = createTenant();
    const fields = {
      name: '  Maria   da Silva  ',
      email: '  MARIA@EXAMPLE.COM ',
    };

    tenant.updateProfile(fields);
    tenant.updateProfile(fields);

    expect(tenant.name).toBe('Maria da Silva');
    expect(tenant.email).toBe('maria@example.com');
  });

  it('stores only a tenant-photo private document key', () => {
    const tenant = createTenant();
    const key =
      'documents/tenant-photos/9465500e-0a06-452a-b1a8-9a3b117f3af0/123e4567-e89b-42d3-a456-426614174000.heic';

    tenant.setPhotoStorageKey(key);

    expect(tenant.photoStorageKey).toBe(key);
    expect(() => tenant.setPhotoStorageKey('../private/photo.jpg')).toThrow(ValidationError);
  });
});
