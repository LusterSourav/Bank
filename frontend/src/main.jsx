import React from 'react';
import ReactDOM from 'react-dom/client';


import App from './App.jsx';
import{ErrorBoundary}from './App.jsx';
import './index.css';
import './i18n.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
