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

项目包含两套独立桌宠系统，通过右键菜单自由切换：

#### 普瑞赛斯

素材来源于[claude code，但是普瑞赛斯](https://github.com/SVAH-X/claude-code-but-priestess)，在重写状态机的基础上添加了唱歌立绘、转身动作。

- **10 套表情**：idle / happy / angry / threat / cry / sleep / singing-1~4
- **3 帧眨眼**：半眯 → 快闭 → 全闭，3.5~8.5s 随机间隔
- **情绪系统**：
  - 点击升级链：2.5s 窗口连续点击 → happy → angry → threat，每层随机缓冲阈值
  - 起床气：sleep 时点击直接进入 angry
  - 暴怒：threat 状态继续连点（4-10 随机阈值）→ 发抖 + 变大 → CRT 关机动画 → 跳转 404
  - 闲置计时：2 分钟 cry → 4 分钟 sleep（Z 字符漂浮特效）
- **唱歌状态机**：检测音频信号后自动进入，singing-1~4 按概率随机切换（0.7~3s 间隔），彩色发光音符漂浮
- **物理动画**：呼吸缩放（正弦波）+ 浮动 + 抖动（每情绪独立参数）
- **拖拽**：Pointer Events 完整拖拽系统，防误触 moved 标志
- **转身跟踪**：鼠标 10~120s 不动 → 转头看鼠标方向 → 退出后 5~10s 跟踪期
- **粒子特效**：点击出白色发光粒子，唱歌点击出彩色音符
- **Canvas 预渲染**：turnside 帧镜像（避免 CSS scaleX(-1) 纹理闪帧）

#### U酱（Live2D 桌宠）

素材来源于[【模型配布】尤里卡酱是我岛最强干员我把把带](https://www.bilibili.com/video/BV1z24y1j7CR/?share_source=copy_web&vd_source=6da714985b7d49750851fb43c0236124)

- **PIXI.js + Cubism 4** 渲染，独立模型加载/管理
- **动态表情**：通过 exp3 文件切换情绪（idle/3clever/4OAO/5QAQ/9/2mic）
- **自动眨眼**：ParamEyeLOpen/ROpen 控制，2.5~6s 间隔
- **鼠标跟踪**：ParamAngleX/Y/Z + ParamEyeBallX/Y 平滑插值
- **道具系统**：右键切换桌子（Param4）/ 麦克风（Param），唱歌自动呼出麦克风
- **唱歌**：张嘴模拟（随机 mouthOpen 目标值 + 帧率补偿）+ 闭眼/睁眼随机切换 + 头部摇摆 + LRC 歌词
- **情绪**：点击升级链 idle → happy → angry → cry（无暴怒系统），闲置 2min cry / 4min sleep
- 24fps PIXI.Application，模型缩放 0.22，透明画布

#### 对话气泡
- **SpeechBubble**：5 种模式——思考（三点跳动）→ 打字机（45ms/字）→ 停留 → 淡出；歌词（原文+译文）；音符（彩色跳动）；表情包（图片 4s）
- **玻璃拟物**：`backdrop-filter: blur(10px) saturate(150%)` + 阴影 + 小尾巴指向桌宠
- **placement 自适应**：桌宠在右半屏 → 气泡出左侧，反之亦然
- **生命周期**：思考 600ms → 打字 → `len×250ms+2000ms` 停留 → 淡出，收起后 300ms 冷却
- **触发源**：按时段问候 / 情绪变化 / 空闲闲聊（28s 间隔 55% 概率）/ 转身 / 右键介绍

#### 记忆聊天系统

桌宠通过**云朵提问气泡**向用户提问，收集名字、生日、偏好等信息存入 localStorage。回答过的记忆以 `{{key}}` 模板混入日常句库，概率性触发，展现出"有记忆"的互动感。

- **提问调度**：独立 120s 定时器轮询 + 15 分钟冷却，仅在桌宠 idle 且无气泡时触发
- **共享提问句库**（`pet-questions.json`）：5 个初始问题，inputType 支持 `text`（自由输入）和 `choice`（预设选项药丸按钮），每人设区分文案
- **拒绝机制**：点击 ✕ 后该问题不再出现（存 `pet_rejected_questions`）
- **记忆触发句**：各自句库新增 `memory` 数组，`{{user_name}}` 等模板占位。每次 idle 闲聊时 30% 概率优先尝试填充记忆句，成功则 say，失败则 fallback 到普通 idle
- **特殊日期**：生日当天 onMounted 立即触发庆祝——蛋糕 emoji 弹入 + 蜡烛火焰摇曳 + 暖色粒子飘散（纯 CSS 动画），跳过时段问候避免覆盖
- **记忆笔记**（`MemoryNotebook`）：右键菜单"查看记忆"→ 打开纸质感笔记窗口。左侧装订线（圆孔+缝线）+ 奶油纸底 + 淡横线。支持内联编辑（✏️）和删除（🗑），双主题自适应
- **云朵气泡**（`QuestionBubble`）：独立于 SpeechBubble，出现于桌宠头顶（`verticalOffset` 可控）。collapsed 态为纯云朵轮廓（7 层 box-shadow 重叠圆形技法），expanded 态为干净圆角卡片。通过 `@pointerdown.stop + @click.stop` 防止事件穿透到桌宠
- **气泡互斥**：`petEnv.isQuestionActive` 全局锁，提问期间阻塞 SpeechBubble 闲聊/情绪台词

**数据存储（localStorage，snake_case）：**
| Key | 格式 | 说明 |
|-----|------|------|
| `pet_memories` | `{"user_name":{"value":"小明","answered_at":"...","question_id":"q_name"}}` | 所有记忆条目 |
| `pet_rejected_questions` | `["q_name","q_color"]` | 被拒绝的问题 ID |
| `pet_last_question_at` | ISO timestamp | 上次提问时间（冷却用） |

**手势交互**（MediaPipe HandLandmarker）：
  - 张开手掌 ： 展开
  - 拇指食指捏合 ：收起
  - 打响指 ：播放/切歌
  - 挥动食指：让桌宠帮你切换主题！
  - 中指：不要做这个！

### 背景效果

分为两个主题，亮色主题：

- **MagicRings**：Three.js WebGL GLSL 同心光环，delta-time 累积避免速度突变，4 层环 + 渐变色
- 色块光晕 + 网格纹理 radial mask 渐隐
- 主要色调是天蓝、薄荷绿和白色

暗色主题：

- **Galaxy**：VueBits动画库的星空主题背景，在此基础上修改了背景的渐变色
- 动效：有音频时加快星光闪烁和星星运动速度
- 主要色调是深蓝、亮金和黑色

### 404 页面
老普会暴怒并把你送入404。使用CRT 老电视关机动画（白线闪烁收束 → 全黑）→ "404" 故障文本（RGB 色散撕裂 + 抖动，持续循环）→ 发光星星逐粒淡入闪烁 → 黑洞背景。

## 性能优化

- **代码分割**：ECharts（535KB）延迟加载，首屏 JS 从 ~700KB 降至 ~163KB（gzip ~64KB）
- **JS 预加载**：LoadingScreen 动画期间 `import()` 拉取 HomeView + echarts-vendor
- **CDN 字体异步**：Geist / 得意黑 / JetBrains Mono 不阻塞渲染；
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
```
