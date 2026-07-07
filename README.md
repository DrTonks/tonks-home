# tonks-home

Tonks 的个人主页 — 状态聚合 / 项目动态 / 数据可视化。

## 技术栈

- **框架**: Vue 3.5 + TypeScript（严格模式）
- **构建**: Vite 6
- **路由**: Vue Router 4
- **状态**: Pinia
- **UI**: shadcn-vue + Tailwind CSS 3 + Lucide + Element Plus 图标
- **动画**: GSAP 3（含 MotionPath）+ @vueuse/motion
- **图表**: ECharts 5 + vue-echarts
- **3D/粒子**: OGL
- **手势**: @mediapipe/tasks-vision
- **HTTP**: Axios

## 开发

```bash
pnpm install
pnpm dev
```

开发服务器在 `http://localhost:5173`，自动代理 `/api` 到 `http://127.0.0.1:9010`（sleepy 后端）。

## 构建

```bash
pnpm build
pnpm preview
```

## 目录结构

```
src/
├── api/          # API 封装（device/agent/blog/music/calendar/github）
├── components/   # 组件
│   ├── ui/       # shadcn-vue 组件
│   ├── layout/   # 布局组件（BentoGrid 等）
│   ├── heatmap/  # 热力图（Agent + GitHub）
│   ├── calendar/ # 日历
│   ├── blog/     # 博客动态
│   ├── device/   # 设备状态
│   ├── music/    # 音乐播放器
│   ├── auth/     # 管理员认证
│   └── animation/# 动画组件（螺旋展开等）
├── composables/  # 组合式函数
├── lib/          # 工具函数（cn / format / debounce）
├── routes/       # 路由
├── stores/       # Pinia stores
├── styles/       # 全局样式 + 设计 token
├── views/        # 页面
├── App.vue
└── main.ts
```

## 设计 Token

三层架构（primitive → semantic → component），见 `src/styles/tokens.css`。
