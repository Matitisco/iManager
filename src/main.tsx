import { readBootSession } from './lib/boot-cache';
import { prefetchMainRoutes } from './desk/prefetch-routes';
import { PublicCatalogPage } from './catalog/PublicCatalogPage';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PwaUpdate } from './components/PwaUpdate';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initializeInstallEvents, isStandalone, registerServiceWorker } from './lib/pwa';

const catalogMatch = window.location.pathname.match(/^\/c\/([a-z0-9-]{1,160})\/?$/);
if (!catalogMatch) initializeInstallEvents();
document.documentElement.classList.toggle('ios-standalone', isStandalone());
if (!catalogMatch) registerServiceWorker();
if (!catalogMatch && readBootSession()) prefetchMainRoutes();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {catalogMatch ? <PublicCatalogPage slug={catalogMatch[1]} /> : <><App /><PwaUpdate /></>}
    </ErrorBoundary>
  </StrictMode>,
);
