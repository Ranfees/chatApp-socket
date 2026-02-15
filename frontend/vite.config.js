import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // This forces Vite to listen on your hotspot IP
    port: 5173,
    strictPort: true,
  }
})