# Tonks Home — 个人主页

基于 Vue 3 + TypeScript + Vite 构建的交互式个人主页，替代旧版 old-vue 项目。

**在线地址**：https://tonks.top

## 功能

### 螺旋展开动画
页面初始仅显示中心头像，点击后头像逆时针自转一周，5 个区域从外围延迟归位。纯 CSS transition 驱动，零 JS 动画库。

### 数据可视化
- **热力图**：ECharts 日历坐标热力图，Agent 活跃度 + GitHub 贡献图双色切换，近 3/6/12 月下拉筛选
- **技术栈饼图**：南丁格尔玫瑰图，hover 扇区放大

### 智能日历
- 月视图多日连续节日高亮（春节/国庆滑块描边），hover 弹出事件名
- 管理员可增删事件，近期事项独立数据源

### 音乐播放器
黑胶唱片 CSS 旋转 + 唱针臂，五按钮控制，浮动歌单弹出动画，管理员上传

### 设备状态
30s 轮询，"关机中"红色高亮，27 个应用名前映射描述

### 博客动态
文章/项目/时光机三 Tab，滑动玻璃指示器，内容切换淡入淡出

### 视觉风格
- 磨砂玻璃卡片：`bg-white/20` + `backdrop-filter: blur(28px)` + 渐变反光厚度
- 卡片级 3D（`perspective` ±5°）+ 全局微 3D（±2.5°）
- 霞鹜文楷标题 + 得意黑数字 + 思源宋体节日 + Caveat 歌名

### 交互桌宠
6 表情 / 3 帧眨眼 / 点击升级链（happy→angry→threat）/ 拖拽 / 闲置哭/睡 / 呼吸物理 / 白色发光粒子 / 从天而降动画

### 背景效果
Three.js WebGL MagicRings 光环 + 8 色块光晕 + 网格纹理

### 其他
- 管理员系统（密钥 localStorage 持久化）
- 手势识别（MediaPipe 按需加载）
- 移动端响应式降级

## 技术栈

Vue 3.5 + TypeScript + Vite 6 + Tailwind CSS 3 + shadcn-vue + reka-ui + ECharts 5 + Three.js + Pinia + Vue Router 4 + Axios

## 开发

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # 构建 dist/
pnpm ship         # 构建 + SFTP 部署到 tonks.top
```
