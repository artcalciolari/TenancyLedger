import { describe, expect, it } from 'vitest';
import { ApiError, normalizeProblem } from './problem';

describe('normalizeProblem', () => {
  it('preserva os campos válidos do Problem Details', () => {
    const problem = normalizeProblem(
      {
        type: 'https://example.test/problem',
        title: 'ConflictException',
        status: 409,
        detail: 'Registro em conflito.',
        errors: ['primeiro', 2, 'segundo'],
        instance: '/contracts',
        requestId: 'request-1',
        timestamp: '2026-07-12T10:00:00.000Z',
      },
      409,
    );

    expect(problem).toEqual({
      type: 'https://example.test/problem',
      title: 'ConflictException',
      status: 409,
      detail: 'Registro em conflito.',
      errors: ['primeiro', 'segundo'],
      instance: '/contracts',
      requestId: 'request-1',
      timestamp: '2026-07-12T10:00:00.000Z',
    });
  });

  it('cria um fallback seguro para respostas inválidas e falhas de rede', () => {
    const httpProblem = normalizeProblem(null, 500, 'request-2');
    const networkProblem = normalizeProblem({}, 0);

    expect(httpProblem.status).toBe(500);
    expect(httpProblem.requestId).toBe('request-2');
    expect(networkProblem.detail).toContain('conectar');
  });

  it('expõe status e detalhe por ApiError', () => {
    const error = new ApiError(normalizeProblem(undefined, 403));
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(403);
    expect(error.message).toBe(error.problem.detail);
  });
});
