// Mounts the React app inside PrivyProvider for auth context.
// Privy handles email + Google login and wallet creation.
// ponytail: no router, no state management library. The whole app is a
//           single file with state-based screen switching.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider } from '@privy-io/react-auth';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID}>
      <App />
    </PrivyProvider>
  </React.StrictMode>
);
