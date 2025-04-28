
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { mockBackend } from './lib/mockBackend';

async function main() {
  // Initialize mock backend
  await mockBackend.init();
  
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

main();
