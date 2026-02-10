import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import './index.css';
import { getProxyBaseUrl } from './services/providers/proxy';

const applyCsp = () => {
  if (typeof __APP_ENV__ === 'undefined' || __APP_ENV__ !== 'production') return;
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!meta) return;
  const proxyOrigin = getProxyBaseUrl();
  meta.setAttribute(
    'content',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' ${proxyOrigin} ws://localhost:3000 https: http:`,
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
};

applyCsp();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
