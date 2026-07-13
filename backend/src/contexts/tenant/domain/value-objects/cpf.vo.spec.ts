import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { CpfVO } from './cpf.vo';

describe('CpfVO', () => {
  it('normaliza e aceita um CPF com dígitos verificadores válidos', () => {
    expect(CpfVO.create('529.982.247-25').value).toBe('52998224725');
  });

  it.each(['111.111.111-11', '529.982.247-24', '123'])('rejeita o CPF inválido %s', (cpf) => {
    expect(() => CpfVO.create(cpf)).toThrow(ValidationError);
  });
});
