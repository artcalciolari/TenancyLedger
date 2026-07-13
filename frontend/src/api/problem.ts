export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: string[];
  instance: string;
  requestId: string | null;
  timestamp: string;
}

const fallbackProblem = (status: number, requestId: string | null): ApiProblem => ({
  type: 'about:blank',
  title: status === 0 ? 'NetworkError' : 'RequestError',
  status,
  detail:
    status === 0
      ? 'Não foi possível conectar ao servidor.'
      : 'Não foi possível concluir a solicitação.',
  instance: '',
  requestId,
  timestamp: new Date().toISOString(),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function normalizeProblem(
  value: unknown,
  status: number,
  responseRequestId: string | null = null,
): ApiProblem {
  const fallback = fallbackProblem(status, responseRequestId);
  if (!isRecord(value)) return fallback;

  return {
    type: typeof value.type === 'string' ? value.type : fallback.type,
    title: typeof value.title === 'string' ? value.title : fallback.title,
    status: typeof value.status === 'number' ? value.status : status,
    detail: typeof value.detail === 'string' ? value.detail : fallback.detail,
    errors: Array.isArray(value.errors)
      ? value.errors.filter((item): item is string => typeof item === 'string')
      : undefined,
    instance: typeof value.instance === 'string' ? value.instance : '',
    requestId:
      typeof value.requestId === 'string' || value.requestId === null
        ? value.requestId
        : responseRequestId,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : fallback.timestamp,
  };
}

export class ApiError extends Error {
  readonly problem: ApiProblem;

  constructor(problem: ApiProblem, options?: ErrorOptions) {
    super(problem.detail, options);
    this.name = 'ApiError';
    this.problem = problem;
  }

  get status(): number {
    return this.problem.status;
  }
}
