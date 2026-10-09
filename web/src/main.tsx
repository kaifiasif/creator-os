import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/app';
import { AuthGate } from '@/app/auth-gate';
import { Providers } from '@/app/providers';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <AuthGate>
        <App />
      </AuthGate>
    </Providers>
  </StrictMode>,
);
