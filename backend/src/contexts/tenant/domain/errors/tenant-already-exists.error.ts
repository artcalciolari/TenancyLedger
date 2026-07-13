import { ConflictError } from '../../../../core/domain/errors/conflict.error';

export class TenantAlreadyExistsError extends ConflictError {
  constructor() {
    super('Já existe um inquilino com o mesmo CPF, e-mail ou telefone.');
  }
}
