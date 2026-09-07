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
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase';
          }
          if (id.includes('node_modules/papaparse') || id.includes('node_modules/qrcode-generator') || id.includes('node_modules/lucide-react')) {
            return 'utils';
          }
          if (id.includes('/src/pages/PickupPage.') || id.includes('/src/pages/CashierVerifyPage.')) {
            return 'pages-checkout';
          }
          if (id.includes('/src/pages/QueuePage.') || id.includes('/src/pages/QueueDisplayPage.') || id.includes('/src/pages/CustomerCheckinPage.')) {
            return 'pages-queue';
          }
          if (id.includes('/src/pages/GuestPortalPage.') || id.includes('/src/pages/GuestQueueStatusPage.')) {
            return 'pages-guest';
          }
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
