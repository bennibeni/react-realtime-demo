import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { financialNewsPlugin } from './server/financial-news.js'

export default defineConfig({
  plugins: [react(), financialNewsPlugin()],
})
