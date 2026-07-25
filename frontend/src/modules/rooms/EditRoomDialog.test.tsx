import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoomView } from '../../api/contract';
import { EditRoomDialog } from './EditRoomDialog';

const room: RoomView = {
  id: 'c2926b25-4e17-44a8-8097-9c093f842cbb',
  buildingId: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
  number: '101',
  createdAt: '2026-07-12T12:00:00.000Z',
  buildingName: 'Edifício Aurora',
  buildingNeighborhood: 'Centro',
  buildingAddress: 'Rua das Flores, 10',
  occupied: false,
};

function renderDialog(value = room) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <EditRoomDialog
      room={value}
      open
      isPending={false}
      error={null}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onClose, onSubmit };
}

describe('EditRoomDialog', () => {
  it('valida o número do quarto antes de submeter', async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Número do quarto' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Informe o número do quarto.')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia apenas o número atualizado', async () => {
    const { onClose, onSubmit } = renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Número do quarto' }));
    await user.type(screen.getByRole('textbox', { name: 'Número do quarto' }), '202');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ number: '202' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
