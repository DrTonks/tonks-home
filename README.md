# Tonks Home — 个人主页

Vue 3 + TypeScript + Vite 交互式个人主页。

## 页面结构

初始状态显示中心头像 + 名称 "DrTonks" + 简介。点击头像展开 5 区域环绕布局（左上热力图·技术栈 / 右上设备 / 左下日历 / 中下博客 / 右下音乐），再次点击收起。移动端（<768px）降级为纵向卡片栈。

## 功能模块

### 蜂窝矩阵加载屏
18×16 六边形 SVG 动画：描边浮现 → 环形 spinner 旋转 → 中心向外淡出 → 整体渐隐。期间并行预加载图片资源 + 首页 JS chunk（echarts-vendor、HomeView），动画结束后首页直接渲染。CDN 字体全部异步加载（`media="print" onload`），不阻塞首屏。

### 热力图 & 技术栈
- **Agent 热力图**：ECharts 日历坐标系，活跃度色阶
- **GitHub 贡献图**：双色 Tab 切换，蓝色玻璃滑动指示器，"拉取 GitHub 数据中"加载提示
- **技术栈玫瑰图**：`roseType: 'area'` 南丁格尔环形饼图
- Element Plus 下拉筛选 3/6/12 个月

### 日历
- 月视图 + 今日卡片 + 近期节日 + 待办 bento 布局
- 多日连续节日滑块高亮（春节/国庆/五一等）
- hover 浮窗显示事件名，点击弹窗查看/增删（管理员）

### 音乐播放器
- **黑胶唱片**：CSS 旋转动画，唱针臂随播放倾转
- **音频可视化**：Canvas 2D 环形频谱，72 根径向音柱环绕头像，色相随频段从天蓝过渡到薄荷绿，EQ 补偿高音区，相邻音柱 15% 能量带动
- **控制栏**：播放模式（列表循环/随机/单曲循环）+ 上一首 + 播放/暂停 + 下一首，单键切换模式
- **音量**：竖向滑块弹窗，点击轨道 + 拖拽调节，CSS transition 点击动画，拖拽零延迟
- 浮动歌单 absolute 弹出，管理员 Dialog 上传

### 交互桌宠
- **10 套表情**：idle / happy / angry / threat / cry / sleep / singing-1~4
- **3 帧眨眼**：半眯 → 快闭 → 全闭
- **情绪系统**：
  - 点击升级链：2.5s 窗口连续点击 → happy → angry → threat，每层随机缓冲阈值
  - 起床气：sleep 时点击直接进入 angry
  - 暴怒：threat 状态继续连点（4-10 随机阈值）→ 发抖 + 变大 → CRT 关机动画 → 跳转 404
  - 闲置计时：2 分钟 cry → 4 分钟 sleep（带 Z 字符漂浮特效）
- **唱歌状态机**：检测到音频信号后自动进入，singing-1~4 按概率随机切换（0.7~3s 间隔），50% 概率触发微动，彩色发光音符漂浮。音乐停止必经 singing-1 退出
- **物理动画**：呼吸缩放 + 浮动 + 抖动（每个情绪独立参数）
- **粒子特效**：点击出白色发光粒子，唱歌点击出彩色音符
- **手势交互**（MediaPipe HandLandmarker）：
  - 🖐️ 张开手掌 → 展开
  - 👌 拇指食指捏合 → 收起
  - 🫰 打响指 → 切歌

### 背景效果
- **MagicRings**：Three.js WebGL GLSL 同心光环，delta-time 累积避免速度突变，4 层环 + 渐变色
- 色块光晕 + 网格纹理 radial mask 渐隐
- 展开时挂载，收起卸载（零性能开销）

### 404 页面
CRT 老电视关机动画（白线闪烁收束 → 全黑）→ "404" 故障文本（RGB 色散撕裂 + 抖动，持续循环）→ 发光星星逐粒淡入闪烁 → 黑洞背景。

### 视觉效果
- **磨砂玻璃**：`bg-white/20` + `backdrop-filter: blur(28px) saturate(190%)`
- **全局微 3D**：`perspective(2000px)` 鼠标倾斜
- **字体**：Geist Sans（正文）+ JetBrains Mono（等宽）+ 得意黑（数字/强调）+ 系统楷体（标题）+ Caveat（歌名/签名）
- **色调**：深天蓝主强调 + 鼠尾草绿次强调 + 琥珀金点缀

## 性能优化

- **代码分割**：ECharts（535KB）延迟加载，首屏 JS 从 ~700KB 降至 ~163KB（gzip ~64KB）
- **JS 预加载**：LoadingScreen 动画期间 `import()` 拉取 HomeView + echarts-vendor
- **CDN 字体异步**：Geist / 得意黑 / JetBrains Mono 不阻塞渲染；霞鹜文楷已移除改用系统楷体
- **MediaPipe 按需加载**：136KB dynamic import，仅在手势激活时下载
- **音频分析**：AnalyserNode 在音频线程处理，主线程每帧仅 `getByteFrequencyData()` 一次，~0.1ms

## 技术栈

Vue 3.5 + TypeScript + Composition API  
Vite 6 + Tailwind CSS 3 + reka-ui  
ECharts 5 + vue-echarts + Element Plus  
Three.js（MagicRings）+ Web Audio API（音频可视化）  
MediaPipe HandLandmarker（手势识别）  
Pinia + Vue Router 4 + Axios

## 开发

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # 构建 dist/
pnpm ship         # 构建 + SFTP 部署
```
