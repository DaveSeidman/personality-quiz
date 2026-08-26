import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/personality-quiz/',
  plugins: [react()],
  server: {
    port: 8080,
    allowedHosts: ['363e-173-68-254-230.ngrok-free.app']
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern'
      }
    }
  }
})