import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  // define: {
  //   'process.env.NODE_ENV': '"production"',
  //   __DEV__: false,
  // },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'app/index.ts'),
      name: 'ShadcnLib',
      fileName: format => `shadcn-template.${format}.js`,
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-hook-form'],
      output: {
        format: 'iife',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        assetFileNames: assetInfo => {
          return assetInfo.name === 'style.css' ? 'shadcn-template.css' : assetInfo.name || 'asset';
        },
      },
    },
    minify: false,
    sourcemap: false,
  },
});
