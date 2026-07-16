import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PropertyView } from '../../api/contract';
import { EditPropertyDialog } from './EditPropertyDialog';

const standaloneProperty: PropertyView = {
  id: 'c2926b25-4e17-44a8-8097-9c093f842cbb',
  neighborhood: 'Centro',
  type: 'APARTMENT',
  unitNumber: '101',
  createdAt: '2026-07-12T12:00:00.000Z',
  buildingId: null,
  buildingName: null,
  occupied: false,
};

function renderDialog(property = standaloneProperty) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <EditPropertyDialog
      property={property}
      open
      isPending={false}
      error={null}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onClose, onSubmit };
}

describe('EditPropertyDialog', () => {
  it('valida o número da unidade antes de submeter', async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Número da unidade' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Informe o número da unidade.')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('omite bairro e vínculo ao editar uma unidade ligada a prédio', async () => {
    const linkedProperty: PropertyView = {
      ...standaloneProperty,
      buildingId: '3d6f0c9e-3c9a-4d3b-9d0a-8f6e5c1a2b3c',
      buildingName: 'Edifício Aurora',
    };
    const { onClose, onSubmit } = renderDialog(linkedProperty);
    const user = userEvent.setup();
    expect(screen.getByRole('textbox', { name: 'Bairro' })).toBeDisabled();
    await user.clear(screen.getByRole('textbox', { name: 'Número da unidade' }));
    await user.type(screen.getByRole('textbox', { name: 'Número da unidade' }), '202');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ unitNumber: '202', type: 'APARTMENT' }),
    );
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('buildingId');
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('neighborhood');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
