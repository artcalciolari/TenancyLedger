import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { CpfVO } from './cpf.vo';

describe('CpfVO', () => {
  it('normaliza e aceita um CPF com dígitos verificadores válidos', () => {
    expect(CpfVO.create('529.982.247-25').value).toBe('52998224725');
    expect(CpfVO.create('168.995.350-09').value).toBe('16899535009');
  });

  it('permite hidratação sem valor pelo ORM', () => {
    const HydratableCpf = CpfVO as unknown as new () => CpfVO;

    expect(new HydratableCpf().value).toBeUndefined();
  });

  it.each(['111.111.111-11', '529.982.247-24', '123'])('rejeita o CPF inválido %s', (cpf) => {
    expect(() => CpfVO.create(cpf)).toThrow(ValidationError);
  });
});
