import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
    base: './',
    plugins: [
        react(),
        legacy({
            targets: ['chrome >= 61', 'android >= 61'],
            modernPolyfills: true
        })
    ],
    server: {
        host: '0.0.0.0',
        port: 5173
    }
})
