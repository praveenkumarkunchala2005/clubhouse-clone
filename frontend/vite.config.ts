import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [react(), basicSsl()],
    server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://192.168.1.9:3001',
                changeOrigin: true,
            },
            '/socket.io': {
                target: 'http://192.168.1.9:3001',
                ws: true,
                changeOrigin: true,
            },
            '/livekit': {
                target: 'http://192.168.1.9:7880',
                ws: true,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/livekit/, ''),
            },
        },
    },
});
