import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { AppProviders } from '../src/app/providers/AppProviders';

const preview: Preview = {
  decorators: [
    (Story) => (
      <MemoryRouter>
        <AppProviders>
          <Story />
        </AppProviders>
      </MemoryRouter>
    ),
  ],
  parameters: {
    a11y: { test: 'error' },
    controls: { expanded: true },
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default preview;
