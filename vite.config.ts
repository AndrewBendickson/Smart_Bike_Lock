import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,                     // allow external access
    allowedHosts: ['.ngrok-free.dev'], // allow any ngrok-free.dev tunnel
  },
})