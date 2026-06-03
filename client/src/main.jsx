import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { ConfettiProvider } from './components/ConfettiEffect.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfettiProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfettiProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
