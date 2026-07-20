import { TenantCivilStatus } from '../../../domain/entities/tenant.entity';
import { UserRole } from '../../../../auth/domain/entities/user.entity';
import { TenantView } from '../../../application/queries/tenant.queries';
import { TenantResponseDto } from './tenant-response.dto';

describe('TenantResponseDto', () => {
  const tenant: TenantView = {
    id: 'f273fac8-c194-4b2b-957d-81bf1230d81d',
    name: 'Maria da Silva',
    cpf: '52998224725',
    profession: 'Engenheira',
    civilStatus: TenantCivilStatus.SINGLE,
    email: 'maria@example.com',
    mobilePhone: '11987654321',
    hasPhoto: true,
  };

  it('não expõe RG nem dados de contato completos quando nenhum papel é informado', () => {
    const response = TenantResponseDto.from(tenant);

    expect(response).toEqual({
      id: 'f273fac8-c194-4b2b-957d-81bf1230d81d',
      name: 'Maria da Silva',
      cpf: '***.***.***-25',
      profession: 'Engenheira',
      civilStatus: TenantCivilStatus.SINGLE,
      email: 'm***@example.com',
      mobilePhone: '(**) *****-4321',
      hasPhoto: true,
    });
    expect(response).not.toHaveProperty('rg');
    expect(JSON.stringify(response)).not.toContain('52998224725');
  });

  it('mascara o contato para VIEWER', () => {
    const response = TenantResponseDto.from(tenant, UserRole.VIEWER);

    expect(response.cpf).toBe('***.***.***-25');
    expect(response.email).toBe('m***@example.com');
    expect(response.mobilePhone).toBe('(**) *****-4321');
  });

  it.each([UserRole.ADMIN, UserRole.MANAGER])('expõe o contato bruto para %s', (role) => {
    const response = TenantResponseDto.from(tenant, role);

    expect(response.cpf).toBe('52998224725');
    expect(response.email).toBe('maria@example.com');
    expect(response.mobilePhone).toBe('11987654321');
  });
});
