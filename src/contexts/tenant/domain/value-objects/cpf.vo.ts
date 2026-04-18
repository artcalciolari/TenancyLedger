import { Column } from 'typeorm';
import { ValidationError } from '../../../../core/domain/errors/validation.error';

export class CpfVO
{
  @Column({ name: 'cpf', length: 11, unique: true })
  private readonly _value!: string;

  // Construtor privado para o TypeORM e para evitar instanciação direta
  private constructor(value?: string)
  {
    if (value) this._value = value;
  }

  static create(value: string): CpfVO
  {
    const clean = value.replace(/\D/g, '');
    if (clean.length !== 11)
    {
      throw new ValidationError('CPF inválido. O CPF deve conter exatamente 11 dígitos numéricos.');
    }
    return new CpfVO(clean);
  }

  get value(): string
  {
    return this._value;
  }
}
