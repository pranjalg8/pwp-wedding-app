import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/pwp-wedding-app/',
  plugins: [react()],
  // amazon-cognito-identity-js (via its buffer dependency) expects a Node-style `global`.
  define: { global: 'globalThis' },
})
