import { ValidationError } from '../../../../core/domain/errors/validation.error';

export class CpfVO {
  private readonly _value!: string;

  // Construtor privado para o TypeORM e para evitar instanciação direta
  private constructor(value?: string) {
    if (value) this._value = value;
  }

  static create(value: string): CpfVO {
    const clean = CpfVO.normalize(value);
    if (!CpfVO.isValid(clean)) {
      throw new ValidationError('CPF inválido.');
    }
    return new CpfVO(clean);
  }

  static normalize(value: string): string {
    return value.replace(/\D/g, '');
  }

  private static isValid(value: string): boolean {
    if (value.length !== 11 || /^(\d)\1{10}$/.test(value)) {
      return false;
    }

    const digits = [...value].map(Number);
    const calculateDigit = (length: number): number => {
      const sum = digits
        .slice(0, length)
        .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
      const remainder = sum % 11;
      return remainder < 2 ? 0 : 11 - remainder;
    };

    return digits[9] === calculateDigit(9) && digits[10] === calculateDigit(10);
  }

  get value(): string {
    return this._value;
  }
}
