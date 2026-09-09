# 主题空切换、默认粒子与横幅渐隐

本轮修改仅保留在本地，未部署两个前端、未修改后端或云端、未提交 Git。

## 行为

- 两个网站按目标实际亮暗与当前页面比较。系统为暗色时，在 system 和 dark 之间切换只保存偏好，不启动截图扩散、粒子或新的过渡等待；亮色同理。切回 system 后仍会跟随系统变化。
- 博客「头像粒子化主题过渡」在受支持的桌面浏览器默认开启；保存过 false 的手动关闭选择继续生效。移动端、宽屏纯触摸设备、减少动态效果以及不支持 View Transition 的浏览器禁用。
- WebGL 支持检测复用实际渲染上下文。初始化/分配失败或上下文丢失会清理资源、更新 UI 为不可用，并在本页面会话停止重试；不写坏用户偏好，刷新后可重新检测。没有额外的探测上下文。
- 水波纹关闭时移除原来的雾状 veil，改用横幅整体透明度遮罩，在容器底部之前完全变透明，避免 overflow 裁断渐变产生硬边。包含移动端文字背景，避免其留下第二条线。遮罩不改变横幅高度和正文位置，不增加 RAF、模糊滤镜或图片文件。
- 水波纹打开时恢复原有波浪显示并撤去渐隐遮罩。保留原来的系统减少动态效果支持。

## 验证

- 主页主题测试 3/3，博客主题与粒子测试 16/16。Svelte 单组件编译零警告。
- 独立子 agent 对主题修改和横幅修改分别复审，未发现新增 P1/P2；额外探针涵盖 VT 异常、shader/program/texture 分配失败、解码失败、上下文丢失和锁释放。
- 真实 Edge 实测：桌面无偏好创建一个实际头像 WebGL 上下文；system/dark 同外观切换 VT 调用数为零，偏好仍保存；返回 system 后随 OS 变色；真实变色时记录到整页和头像两个裁剪及实际 drawArrays。
- 手动关闭后刷新零 GPU 初始化；模拟 WebGL 不可用时只尝试一次并禁用 UI；缺少 VT、移动端及 reduced-motion 均为零 GPU 初始化。
- 两站实际 UI 操作通过。早期自动化批次曾只捕获 root 扩散，诊断期间观察到菜单操作伴随自动滚动；原有 scroll 取消粒子保护保留。后续完整批次正常记录到 begin/capture/start 与实际绘制，不据此声称每次滚动或离屏时也必须播放粒子。
- 横幅桌面 1280×900 和手机 390×844，各验证亮暗两种主题。computed mask 生效，旧 veil 不存在，截图已检查；另通过真实 UI 核对水波纹开/关对应 mask none/渐变。
- 本轮使用实际开发页面及针对性测试，没有重新运行全站生产构建，不把上轮构建结果当本轮结果。临时截图在检查后清理。

## 文件

主页：src/stores/theme.ts、src/stores/theme.test.ts（新增）。

博客：src/utils/setting-utils.ts、src/utils/theme-avatar.ts、src/components/widget/DisplaySettings.svelte、src/layouts/MainGridLayout.astro、scripts/theme-avatar-particles.test.mjs，以及对应行为文档。

已有本地修改继续保留。两个项目均可使用 pnpm dev 人工验收；本轮没有执行 ship。
