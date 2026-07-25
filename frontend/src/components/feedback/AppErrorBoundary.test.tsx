import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppErrorFallback, AppRenderErrorBoundary, RouteErrorPage } from './AppErrorBoundary';

const { reportClientError } = vi.hoisted(() => ({ reportClientError: vi.fn() }));

vi.mock('../../lib/observability/client-observability', () => ({ reportClientError }));

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
    expect(reportClientError).toHaveBeenCalledWith(expect.any(Error), { kind: 'RENDER' });
  });

  it('aceita mensagem customizada e executa recarga', () => {
    render(<AppErrorFallback title="Título customizado" description="Descrição customizada" />);
    expect(screen.getByRole('heading', { name: 'Título customizado' })).toHaveFocus();
    expect(screen.getByText('Descrição customizada')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }));
  });

  it('mostra mensagem específica para rota inexistente', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: () => {
            // React Router represents HTTP route failures as thrown Response objects.
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw new Response(null, { status: 404 });
          },
          element: <span>page</span>,
          errorElement: <RouteErrorPage />,
        },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Página não encontrada' })).toHaveFocus();
    expect(screen.getByText(/endereço solicitado não existe/)).toBeVisible();
  });

  it('usa fallback padrão para outros erros de rota', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: () => {
            throw new Error('route failed');
          },
          element: <span>page</span>,
          errorElement: <RouteErrorPage />,
        },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByRole('heading', { name: 'Não foi possível exibir esta página' }),
    ).toHaveFocus();
  });
});
