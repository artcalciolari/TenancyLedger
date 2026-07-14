import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import '@fontsource/hanken-grotesk/700.css';
import '@fontsource/hanken-grotesk/800.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
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
