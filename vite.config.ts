import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 从环境变量读取后端地址，避免 IP 硬编码进公开仓库
  const apiTarget = process.env.VITE_API_TARGET || env.VITE_API_TARGET || 'http://localhost:9010'
  const articleIndexTarget = process.env.VITE_ARTICLE_INDEX_TARGET || env.VITE_ARTICLE_INDEX_TARGET || 'https://blog.tonks.top'

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
        // Apache provides this alias in production; keep article selection
        // available in pnpm dev too. Override with the local blog dev origin
        // when previewing unpublished articles/headings.
        '^/community/articles\\.json(?:\\?|$)': {
          target: articleIndexTarget,
          changeOrigin: true,
        },
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
