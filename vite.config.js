import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    // 启用代码分割：分离 vendor、pages、核心库
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'utils': ['papaparse', 'qrcode-generator', 'lucide-react'],
          'pages-checkout': ['./src/pages/PickupPage.jsx', './src/pages/CashierVerifyPage.jsx'],
          'pages-queue': ['./src/pages/QueuePage.jsx', './src/pages/QueueDisplayPage.jsx', './src/pages/CustomerCheckinPage.jsx'],
          'pages-guest': ['./src/pages/GuestPortalPage.jsx', './src/pages/GuestQueueStatusPage.jsx'],
        },
      },
    },
    // 增加警告阈值并启用高效压缩
    chunkSizeWarningLimit: 600,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除 console
      },
    },
  },
});
