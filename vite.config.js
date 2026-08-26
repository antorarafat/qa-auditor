const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react-vendor';
          if (id.includes('node_modules/marked') || id.includes('node_modules/dompurify')) return 'document-vendor';
          if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/cmdk')) return 'selection-vendor';
          if (id.includes('node_modules/lucide-react')) return 'icons-vendor';
        }
      }
    }
  }
});
