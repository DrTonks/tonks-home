import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 从环境变量读取后端地址，避免 IP 硬编码进公开仓库
  const apiTarget = process.env.VITE_API_TARGET || env.VITE_API_TARGET || 'http://localhost:9010'
  const geoipTarget = process.env.VITE_GEOIP_TARGET || env.VITE_GEOIP_TARGET || 'https://tonks.top'

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
        // 本地开发复用线上 /geoip，避免 Node/Vite 直连 ip-api 免费 HTTP 端点超时。
        // 请求仍从开发者本机发出，线上 Apache 看到的是开发者公网出口地址。
        // 生产构建不包含 dev proxy，部署后仍由本站 Apache 处理同一路径。
        '/geoip': {
          target: geoipTarget,
          changeOrigin: true,
        },
        // 心知天气代理：避免浏览器直连 api.seniverse.com 导致 403
        '/seniverse': {
          target: 'https://api.seniverse.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/seniverse/, ''),
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
