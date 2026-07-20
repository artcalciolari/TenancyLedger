import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TenantView } from '../../api/contract';
import { EditTenantDialog } from './EditTenantDialog';

const tenant: TenantView = {
  id: '9465500e-0a06-452a-b1a8-9a3b117f3af0',
  name: 'Maria da Silva',
  cpf: '529.982.247-25',
  profession: 'Engenheira',
  civilStatus: 'SINGLE',
  email: 'maria@example.com',
  mobilePhone: '11987654321',
  hasPhoto: false,
};

function renderDialog() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <EditTenantDialog
      tenant={tenant}
      open
      isPending={false}
      error={null}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onClose, onSubmit };
}

describe('EditTenantDialog', () => {
  it('valida o e-mail antes de submeter', async () => {
    const { onSubmit } = renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'E-mail' }));
    await user.type(screen.getByRole('textbox', { name: 'E-mail' }), 'invalido');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Informe um e-mail válido.')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submete somente os campos editáveis', async () => {
    const { onClose, onSubmit } = renderDialog();
    const user = userEvent.setup();
    await user.clear(screen.getByRole('textbox', { name: 'Nome completo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome completo' }), 'Maria Souza');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Maria Souza',
        profession: 'Engenheira',
        civilStatus: 'SINGLE',
        email: 'maria@example.com',
        mobilePhone: '11987654321',
      }),
    );
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('cpf');
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('rg');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
