export abstract class DomainError extends Error {
  readonly code: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code ?? this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
