import { describe, expect, it } from 'vitest';
import type { ApiError } from './problem';
import { executeOpenApi, executeOpenApiVoid } from './openapi-client';

describe('OpenAPI client execution', () => {
  it('retorna a resposta tipada de sucesso', async () => {
    const data = { id: '123' };
    await expect(
      executeOpenApi(Promise.resolve({ data, response: new Response(null, { status: 200 }) })),
    ).resolves.toEqual(data);
  });

  it('normaliza respostas problem+json', async () => {
    const error = {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Registro em conflito.',
      instance: '/resource',
      requestId: 'req-1',
      timestamp: '2026-07-12T00:00:00.000Z',
    };
    const request = executeOpenApi(
      Promise.resolve({ error, response: new Response(null, { status: 409 }) }),
    );
    const expected: Pick<ApiError, 'status' | 'problem'> = { status: 409, problem: error };
    await expect(request).rejects.toMatchObject(expected);
  });

  it('converte falha de rede em ApiError de status zero', async () => {
    await expect(executeOpenApi(Promise.reject(new TypeError('offline')))).rejects.toMatchObject({
      status: 0,
    });
  });

  it('aceita respostas sem conteúdo', async () => {
    await expect(
      executeOpenApiVoid(Promise.resolve({ response: new Response(null, { status: 204 }) })),
    ).resolves.toBeUndefined();
  });
});
