import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './style.css';
import './system.css';
import './education.css';
import { App } from './App';

const container = document.getElementById('root')!;
const render =
  container.hasChildNodes() &&
  container.dataset.route === (location.pathname.replace(/\/$/, '') || '/') &&
  !location.search
    ? (app: React.ReactNode) => hydrateRoot(container, app)
    : (app: React.ReactNode) => createRoot(container).render(app);
render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
