import type { Meta, StoryObj } from '@storybook/react-vite';
import { ApiError } from '../../api/problem';
import { ProblemAlert } from './ProblemAlert';
import { EmptyState, LoadingState } from './QueryState';

const meta = {
  title: 'Feedback/Estados de consulta',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Carregando: Story = {
  render: () => <LoadingState label="Carregando faturas…" />,
};

export const Vazio: Story = {
  render: () => (
    <EmptyState
      title="Nenhuma fatura encontrada"
      description="Ajuste ou limpe os filtros para tentar novamente."
    />
  ),
};

export const ErroComReferencia: Story = {
  render: () => (
    <ProblemAlert
      error={
        new ApiError({
          type: 'about:blank',
          title: 'Conflito',
          status: 409,
          detail: 'O registro foi alterado por outro operador.',
          instance: '/invoices/example',
          requestId: 'req-storybook-123',
          timestamp: '2026-07-12T12:00:00.000Z',
        })
      }
      onRetry={() => undefined}
    />
  ),
};
