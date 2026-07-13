import { TenantCivilStatus } from '../../../domain/entities/tenant.entity';
import { TenantView } from '../../../application/queries/tenant.queries';
import { TenantResponseDto } from './tenant-response.dto';

describe('TenantResponseDto', () => {
  it('não expõe RG nem dados de contato completos', () => {
    const tenant: TenantView = {
      id: 'f273fac8-c194-4b2b-957d-81bf1230d81d',
      cpf: '52998224725',
      profession: 'Engenheira',
      civilStatus: TenantCivilStatus.SINGLE,
      email: 'maria@example.com',
      mobilePhone: '11987654321',
    };
    const response = TenantResponseDto.from(tenant);

    expect(response).toEqual({
      id: 'f273fac8-c194-4b2b-957d-81bf1230d81d',
      cpf: '***.***.***-25',
      profession: 'Engenheira',
      civilStatus: TenantCivilStatus.SINGLE,
      email: 'm***@example.com',
      mobilePhone: '(**) *****-4321',
    });
    expect(response).not.toHaveProperty('rg');
    expect(JSON.stringify(response)).not.toContain('52998224725');
  });
});
