import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppRenderErrorBoundary } from './AppErrorBoundary';

function BrokenContent(): never {
  throw new Error('falha de renderização simulada');
}

describe('AppRenderErrorBoundary', () => {
  it('substitui uma falha de renderização por um fallback acessível', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppRenderErrorBoundary>
        <BrokenContent />
      </AppRenderErrorBoundary>,
    );

    expect(screen.getAllByRole('alert')).not.toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'Não foi possível exibir esta página' }),
    ).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  });
});
