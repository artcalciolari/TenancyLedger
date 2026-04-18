import { ConflictError } from '../../../../core/domain/errors/conflict.error';

export class TenantAlreadyExistsError extends ConflictError
{
  constructor(cpf: string)
  {
    super(`Já existe um inquilino cadastrado com o CPF ${cpf}.`);
  }
}
