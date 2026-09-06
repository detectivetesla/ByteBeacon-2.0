import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './styles/global.css';
import { initConsoleScrubber } from './utils/console-scrubber.js';

initConsoleScrubber();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root DOM element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
