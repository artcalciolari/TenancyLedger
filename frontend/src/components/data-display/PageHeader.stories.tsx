import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@mui/material';
import { PageHeader } from './PageHeader';

const meta = {
  title: 'Navegação/PageHeader',
  component: PageHeader,
  args: {
    title: 'Faturas',
    description: 'Consulte cobranças, saldos e pagamentos registrados.',
  },
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Padrao: Story = {};

export const ComAcao: Story = {
  args: {
    title: 'Contratos',
    description: 'Consulte vigências e condições das locações.',
    action: { label: 'Novo contrato', to: '/contracts/new' },
  },
};

export const ComAcoesSecundarias: Story = {
  render: (args) => (
    <PageHeader {...args}>
      <Button variant="outlined">Exportar CSV</Button>
    </PageHeader>
  ),
};
