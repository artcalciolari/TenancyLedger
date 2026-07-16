import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BuildingDetailView } from '../../api/contract';
import { EditBuildingDialog } from './EditBuildingDialog';

const building: BuildingDetailView = {
  id: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
  name: 'Edifício Aurora',
  neighborhood: 'Centro',
  address: 'Rua Um, 10',
  createdAt: '2026-07-12T12:00:00.000Z',
  totalUnits: 2,
  occupiedUnits: 1,
  units: [],
};

function renderDialog() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <EditBuildingDialog
      building={building}
      open
      isPending={false}
      error={null}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onClose, onSubmit };
}

describe('EditBuildingDialog', () => {
  it('valida o nome antes de submeter', async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Nome do prédio' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Informe o nome do prédio.')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submete os campos editáveis', async () => {
    const { onClose, onSubmit } = renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Nome do prédio' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome do prédio' }), 'Edifício Solar');
    await user.clear(screen.getByRole('textbox', { name: 'Bairro' }));
    await user.type(screen.getByRole('textbox', { name: 'Bairro' }), 'Bela Vista');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Edifício Solar',
        neighborhood: 'Bela Vista',
        address: 'Rua Um, 10',
      }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });
});
