/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vitest config mirroring vite.config.ts aliases + jsdom environment.
// import.meta.env (VITE_ENABLE_MUTATIONS, etc.) is supported because vitest
// reuses Vite's env loading. Tests that need a specific value stub the
// '@/lib/feature-flags' module directly via vi.mock.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: true,
  },
})
