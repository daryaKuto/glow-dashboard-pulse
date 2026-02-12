import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/tb': {
        target: 'https://thingsboard.cloud',
        changeOrigin: true,
        rewrite: (path) => {
          // Handle WebSocket paths differently
          if (path.includes('/ws/')) {
            return path.replace(/^\/api\/tb\/ws/, '/api/ws');
          }
          return path.replace(/^\/api\/tb/, '/api');
        },
        secure: true,
        ws: true,
        configure: (proxy, _options) => {
          // Handle WebSocket upgrade errors gracefully
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
            // Don't crash on EPIPE errors
            if (err.code === 'EPIPE') {
              console.log('EPIPE error ignored (client disconnected)');
            }
          });
          
          // Proper WebSocket upgrade handling
          proxy.on('proxyReqWs', (proxyReq, req, socket, _options, head) => {
            console.log('Sending WebSocket Request to:', req.url);
            
            // Handle socket errors to prevent crashes
            socket.on('error', (err) => {
              console.log('WebSocket socket error:', err.message);
            });
          });
          
          proxy.on('open', (proxySocket) => {
            // Handle errors on the proxy socket
            proxySocket.on('error', (err) => {
              console.log('Proxy socket error:', err.message);
            });
          });
          
          // Keep existing logging
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/swagger-ui': {
        target: 'https://thingsboard.cloud',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/swagger-ui/, '/swagger-ui'),
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('SwaggerUI proxy error', err);
          });
        },
      }
    }
  },
  preview: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "dashboard-app-uel8h.ondigitalocean.app",
      "localhost",
      "127.0.0.1"
    ]
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
