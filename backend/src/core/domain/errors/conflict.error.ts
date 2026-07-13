import { DomainError } from './domain.error';

// Categoria base para qualquer violação de unicidade ou estado conflitante
export abstract class ConflictError extends DomainError {}
