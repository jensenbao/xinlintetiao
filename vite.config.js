import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io'],
    // 配置代理，解决Google API访问问题
    proxy: {
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
        secure: false
      },
      '/api/save': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/api/mcp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
