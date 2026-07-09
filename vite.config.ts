import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // 开发环境代理到 sleepy 后端
      '/api': {
        target: 'http://8.137.145.5:9010',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // 图片接口（保留 /images 前缀）
      '/images': {
        target: 'http://8.137.145.5:9010',
        changeOrigin: true,
      },
      // 音乐流接口（保留 /music 前缀）
      '/music': {
        target: 'http://8.137.145.5:9010',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'echarts-vendor': ['echarts', 'vue-echarts'],
          'mediapipe-vendor': ['@mediapipe/tasks-vision'],
        },
      },
    },
  },
})
