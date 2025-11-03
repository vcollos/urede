import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
  },
  server: {
    host: '0.0.0.0',
    port: 3400,
    open: command === 'serve',
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      'urede.collos.com.br',
      'apiurede.collos.com.br',
    ],
  },
  preview: {
    host: '0.0.0.0',
    port: 3400,
    open: false,
  },
}));
