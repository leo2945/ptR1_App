// vite.config.js
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: 'src/renderer', // HTML และ JS อยู่ที่นี่
  base: './',
  server: {
    port: 5173
  },
  build: {
    outDir: '../../dist', // ให้ build ไปไว้ข้างนอก
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    }
  }
});
