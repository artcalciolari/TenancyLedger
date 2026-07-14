import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TenantCivilStatus } from '../../../domain/entities/tenant.entity';
import { CreateTenantDto } from './create-tenant.dto';

describe('CreateTenantDto', () => {
  const validInput = {
    name: 'Maria da Silva',
    cpf: '529.982.247-25',
    rg: '12.345.678-9',
    profession: 'Engenheira',
    civilStatus: TenantCivilStatus.SINGLE,
    email: 'maria@example.com',
    mobilePhone: '+55 (11) 98765-4321',
  };

  it('aceita dados brasileiros válidos e transforma e-mail', async () => {
    const dto = plainToInstance(CreateTenantDto, {
      ...validInput,
      email: ' MARIA@EXAMPLE.COM ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.email).toBe('maria@example.com');
  });

  it('rejeita status civil fora do contrato público', async () => {
    const dto = plainToInstance(CreateTenantDto, { ...validInput, civilStatus: 'solteiro' });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'civilStatus')).toBe(true);
  });
});
