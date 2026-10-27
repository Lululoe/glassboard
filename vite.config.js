import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // Never serve config files (which may contain credentials) from the project root.
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '*.yaml', '*.yml']
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    globals: true
  }
})
