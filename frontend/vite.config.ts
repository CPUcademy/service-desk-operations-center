import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      // Dev only: forward API + WebSocket traffic to the backend so the browser
      // sees a single origin and accepts the SameSite=Strict auth cookies.
      proxy: env.API_PROXY_TARGET
        ? {
            '/api': {
              target: env.API_PROXY_TARGET,
              changeOrigin: true,
              ws: true,
            },
          }
        : undefined,
    },
  }
})
