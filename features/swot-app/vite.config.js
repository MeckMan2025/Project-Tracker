import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import localDb from './local-db/plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localDb({ file: '.local-db/db.json' })],
})
