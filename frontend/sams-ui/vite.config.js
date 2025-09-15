import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore']
        },
        // Ensure cache busting with content-based hashes
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  define: {
    // Define environment variables for production build
    'process.env': {}
  },
  resolve: {
    alias: {
      '@CRUD': fileURLToPath(new URL('./src/CRUD', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../shared', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      '/comm': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      // Reduce WebSocket connection error messages in console
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173,
      overlay: false, // Disable the error overlay
      timeout: 60000, // Increase timeout to 60 seconds
    },
  },
});
