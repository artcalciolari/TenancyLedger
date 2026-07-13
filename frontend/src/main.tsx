import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProviders } from './app/providers/AppProviders';
import { AppRenderErrorBoundary } from './components/feedback/AppErrorBoundary';
import { installGlobalErrorReporting } from './lib/observability/client-observability';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz não encontrado.');

installGlobalErrorReporting();

createRoot(root).render(
  <StrictMode>
    <AppRenderErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppRenderErrorBoundary>
  </StrictMode>,
);
