# Tonks Home — 个人主页

Vue 3 + TypeScript + Vite 交互式个人主页，替代旧版 old-vue。

**在线地址**：https://tonks.top

## 页面结构

初始状态仅显示中心头像 + 名称 "DrTonks" + 简介。点击头像展开 5 个区域环绕布局（左上热力图/右上设备/左下日历/中下博客/右下音乐）。再次点击不出收起（展开不可逆）。

移动端（<768px）降级为纵向卡片栈，仅保留设备状态 + 博客动态。

## 功能模块

### 蜂窝矩阵加载屏
每次刷新/首次进入播放 18×16 六边形矩阵动画：描边浮现 → 中心向外淡出 → 整体渐隐。期间后台预加载桌宠表情 + 头像资源。亮色主题配色（浅天蓝填充 + 亮蓝描边 + 冷白底）。

### 螺旋展开
头像逆时针自转一周，5 区域从各自方向延迟归位。纯 CSS `transition + transition-delay`，零动画库。

### 热力图 & 技术栈
- **热力图**：ECharts 日历坐标系，Agent 活跃度 + GitHub 贡献图双色 Tab 切换，Element Plus 下拉筛选 3/6/12 月
- **技术栈南丁格尔玫瑰图**：`roseType: 'area'`，hover 放大，loading 环形 spinner

### 日历
- 月视图 + 今日卡片 + 近期事项 + 待办 bento 布局
- 多日连续节日滑块高亮（春节 7 天/国庆 7 天/五一 5 天等）
- hover 格子浮窗显示事件/节日名
- 点击日期弹窗查看/增删事件（管理员）
- 近期事项独立数据源，不受月份切换影响

### 音乐播放器
- 黑胶唱片 CSS 旋转（暂停冻结 `animation-play-state: paused`）+ 唱针臂（播放逆时针转 -25°）
- 五按钮：随机/上一首/播放暂停/下一首/循环
- 浮动歌单 absolute 弹出，不挤占布局
- 管理员 Dialog 上传，首曲自动选中
- `preload="none"` 避免大文件卡初始加载

### 设备状态
- 30s 自动轮询，网络失败退避 60s
- 状态点脉冲动效（awake=天蓝脉冲，sleeping=静止）
- "关机中"红色高亮，后端 10 分钟超时自动判定
- 40 个应用名的中文描述映射表

### 博客动态
- 文章/项目/时光机三 Tab，默认文章
- 滑动玻璃指示器 `backdrop-blur`
- Tab 内容切换 Transition 淡入淡出

### 交互桌宠
- **6 表情**：idle / happy / angry / threat / cry / sleep（来自 PRTS 角色素材）
- **3 帧眨眼**：半眯 70ms → 快闭 60ms → 全闭 110ms
- **点击升级链**：2.5s 窗口连续点击 → happy → angry → threat，每层随机缓冲阈值
- **闲置计时**：2 分钟 cry，15 分钟 sleep
- **物理动画**：呼吸缩放 + 浮动 + 抖动（每个情绪独立参数，按 SIZE 比例缩放）
- **白色发光粒子**：点击/展开时从点击位置向外扩散（约束在中央贴图区）
- **拖拽**：按住移动，放下冷却 2.5s
- **从天而降**：展开时 `translateY(-120vh)` 0.7s 弹性缓入（`both` fill-mode）

### 背景效果
- **MagicRings**：Three.js WebGL GLSL 着色器，5 层同心光环脉动，alpha 立方曲线消除暗边，mouse follow
- **8 色块光晕**：100-120px 高斯模糊 + 缓慢漂浮
- **网格纹理**：56px 间距 + radial mask 渐隐
- 展开时挂载 `v-if="isExpanded"`，收起卸载（零性能开销）

### 视觉风格
- **磨砂玻璃**：`bg-white/20` + `backdrop-filter: blur(28px) saturate(190%)` + 线性渐变反光厚度 + `border-white/15`
- **卡片 3D**：`perspective(1000px) rotateX/Y ±5°`，mousemove 缓存 rect 避免回流
- **全局微 3D**：`perspective(2000px) rotateX/Y ±2°/±2.5°`
- **字体**：霞鹜文楷（标题）+ 得意黑（数字）+ 思源宋体（节日）+ Caveat（歌名/签名）
- **色调**：深天蓝主强调 + 鼠尾草绿次强调 + 琥珀金点缀

### 其他
- 管理员系统：左下角锁图标 → Dialog 密钥 → localStorage 持久化
- 手势识别：MediaPipe HandLandmarker 按需加载（136KB dynamic import）
- 头像双图无抖动切换：jpg 常驻底层，gif `@load` 淡入覆盖

## 技术栈

Vue 3.5 + TypeScript + Composition API  
Vite 6 + Tailwind CSS 3 + shadcn-vue + reka-ui  
ECharts 5 + vue-echarts  
Three.js（MagicRings）  
Pinia + Vue Router 4 + Axios  
Element Plus（el-select）  
霞鹜文楷 / 得意黑 / 思源宋体 / Caveat / Geist Sans / JetBrains Mono

## 开发

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm build        # 构建 dist/
pnpm ship         # 构建 + SFTP 部署
```
