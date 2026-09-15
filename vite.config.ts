import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the build also runs on hosts that serve it under a subpath.
  base: './',
  // Classic JSX + externalized libraries: the heavy dependencies load as UMD
  // globals from CDN (script tags in index.html), keeping our bundle small
  // enough to embed in the `app` edge function that hosts the site.
  plugins: [react({ jsxRuntime: 'classic' })],
  build: {
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', '@supabase/supabase-js'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-dom/client': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
          '@supabase/supabase-js': 'supabase',
        },
        format: 'iife',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
} as ReturnType<typeof defineConfig>);
