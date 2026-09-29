import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2020' },
  server: { port: 3000, proxy: { '/api': 'http://127.0.0.1:3001' } },
})
