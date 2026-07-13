import { describe, expect, it } from 'vitest';
import { clampPage } from './pagination';

describe('clampPage', () => {
  it('mantém páginas dentro do intervalo', () => {
    expect(clampPage(2, 4)).toBe(2);
  });

  it('volta para a última página disponível quando o total diminui', () => {
    expect(clampPage(5, 2)).toBe(2);
  });

  it('normaliza coleções vazias e páginas inválidas para a primeira página', () => {
    expect(clampPage(3, 0)).toBe(1);
    expect(clampPage(-4, 8)).toBe(1);
  });
});
