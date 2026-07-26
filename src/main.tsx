import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './lib/auth';
import { config } from './config';
import { theme } from './theme';
import App from './App';
import './index.css';

const googleClientId = config.googleClientId;
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <GoogleOAuthProvider clientId={googleClientId}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </GoogleOAuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
