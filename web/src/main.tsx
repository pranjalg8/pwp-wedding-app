import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { Button, MantineProvider } from '@mantine/core'
import { Notifications, notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import './index.css'
import { theme } from './theme.ts'
import App from './App.tsx'
import { AuthProvider } from './components/AuthProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications />
      <AuthProvider>
        <ModalsProvider>
          <App />
        </ModalsProvider>
      </AuthProvider>
    </MantineProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // A new version took over this tab. Only offer a reload when an older version was in charge before
  // (the very first install also fires this) and never reload by itself, so there is no reload loop.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    notifications.show({
      id: 'new-version',
      title: 'New version available',
      message: (
        <Button size="xs" mt={4} onClick={() => window.location.reload()}>
          Reload
        </Button>
      ),
      autoClose: false,
    });
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
