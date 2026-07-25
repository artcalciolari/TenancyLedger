import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RoomSearchStep } from './RoomSearchStep';

const buildingId = '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c';
const roomRequests: URL[] = [];

const server = setupServer(
  http.get('*/api/buildings', () =>
    HttpResponse.json({
      data: [
        {
          id: buildingId,
          name: 'Edifício Aurora',
          neighborhood: 'Centro',
          address: null,
          createdAt: '2026-07-01T10:00:00.000Z',
          totalRooms: 1,
          occupiedRooms: 0,
          vacantRooms: 1,
          vacancyPercentage: 100,
        },
      ],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  ),
  http.get('*/api/rooms', ({ request }) => {
    roomRequests.push(new URL(request.url));
    return HttpResponse.json({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  roomRequests.length = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

function renderStep() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onDateChange = vi.fn();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RoomSearchStep
        moveInDate="2026-07-20"
        selectedId={null}
        onDateChange={onDateChange}
        onSelect={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return { ...rendered, onDateChange };
}

describe('RoomSearchStep', () => {
  it('envia status, data, busca e prédio e remove os filtros ao limpar', async () => {
    const { container, onDateChange } = renderStep();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('combobox', { name: 'Prédio' }));
    await user.click(screen.getByRole('option', { name: 'Edifício Aurora' }));
    const dateInput = container.querySelector<HTMLInputElement>('input[name="date"]');
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput!, { target: { value: '2026-08-15' } });
    await user.type(screen.getByLabelText('Prédio, bairro, endereço ou número'), '101');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(
        roomRequests.some((url) => {
          const query = url.searchParams;
          return (
            query.get('status') === 'VACANT' &&
            query.get('date') === '2026-08-15' &&
            query.get('q') === '101' &&
            query.get('buildingId') === buildingId
          );
        }),
      ).toBe(true);
    });
    expect(onDateChange).toHaveBeenCalledWith('2026-08-15');

    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    await waitFor(() => {
      const lastRequest = roomRequests.at(-1);
      expect(lastRequest?.searchParams.get('date')).toBe('2026-07-20');
      expect(lastRequest?.searchParams.has('q')).toBe(false);
      expect(lastRequest?.searchParams.has('buildingId')).toBe(false);
      expect(lastRequest?.searchParams.get('status')).toBe('VACANT');
    });
  });
});
