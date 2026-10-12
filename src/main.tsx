import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PwaUpdate } from './components/PwaUpdate';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initializeInstallEvents, isStandalone, registerServiceWorker } from './lib/pwa';

initializeInstallEvents();
document.documentElement.classList.toggle('ios-standalone', isStandalone());
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <PwaUpdate />
    </ErrorBoundary>
  </StrictMode>,
);
