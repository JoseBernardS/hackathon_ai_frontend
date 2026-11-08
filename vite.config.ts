import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'node:path'

export default defineConfig({
  // HTTPS only when asked: getUserMedia needs a secure context, so testing the
  // camera on a phone over the LAN requires `npm run dev:https`.
  plugins: [react(), tailwindcss(), ...(process.env.HTTPS ? [basicSsl()] : [])],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173 },
})
