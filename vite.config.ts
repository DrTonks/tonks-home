import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 从环境变量读取后端地址，避免 IP 硬编码进公开仓库
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:9010'

  return {
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
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // 图片接口（保留 /images 前缀）
        '/images': {
          target: apiTarget,
          changeOrigin: true,
        },
        // 音乐流接口（保留 /music 前缀）
        '/music': {
          target: apiTarget,
          changeOrigin: true,
        },
        // IP 定位代理（ip-api.com 免费版仅支持 HTTP，lang=zh-CN 返回中文城市名）
        '/geoip': {
          target: 'http://ip-api.com',
          changeOrigin: true,
          rewrite: (path) => '/json?lang=zh-CN&fields=city,regionName,country,lat,lon',
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
            'pixi-vendor': ['pixi.js', 'pixi-live2d-display'],
          },
        },
      },
    },
  }
})
