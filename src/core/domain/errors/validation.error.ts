import { DomainError } from './domain.error';

// Pode ser instanciada diretamente pelos Value Objects e Entities
export class ValidationError extends DomainError {}
