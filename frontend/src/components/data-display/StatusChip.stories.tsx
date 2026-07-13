import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '@mui/material';
import { StatusChip } from './StatusChip';

const meta = {
  title: 'Dados/StatusChip',
  component: StatusChip,
  args: { status: 'UNDER_REVIEW' },
} satisfies Meta<typeof StatusChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmAnalise: Story = {};

export const TodosOsEstados: Story = {
  render: () => (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {[
        'ACTIVE',
        'EXPIRED',
        'OPEN',
        'UNDER_REVIEW',
        'PARTIALLY_PAID',
        'PAID',
        'OVERDUE',
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
      ].map((status) => (
        <StatusChip key={status} status={status} />
      ))}
    </Stack>
  ),
};
