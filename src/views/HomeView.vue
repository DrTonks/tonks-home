<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import AvatarCore from '@/components/layout/AvatarCore.vue'
import BackgroundLayer from '@/components/layout/BackgroundLayer.vue'
import GalaxyBackground from '@/components/layout/GalaxyBackground.vue'
import ThemeToggle from '@/components/layout/ThemeToggle.vue'
import PetSwitcher from '@/components/layout/PetSwitcher.vue'
import CRTShutdown from '@/components/layout/CRTShutdown.vue'
import { AdminAuth } from '@/components/auth'
import { GestureToggle } from '@/components/gesture'
import { DeviceStatus } from '@/components/device'
import { BlogUpdates } from '@/components/blog'
import { HeatmapPanel, LanguagePanel } from '@/components/heatmap'
import { useMusicStore } from '@/stores/music'
import { useThemeStore } from '@/stores/theme'
import { usePetEnvStore } from '@/stores/petEnv'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'
import { CalendarMonth, TodayCard, UpcomingHolidays, TodoList } from '@/components/calendar'
import { MusicVinyl, MusicControls } from '@/components/music'
import AudioVisualizer from '@/components/music/AudioVisualizer.vue'
import {
  BACKGROUND_IMAGE_COUNT,
  getDeferredBackgroundPaths,
} from '@/config/backgroundImages'
import { getImageUrl } from '@/config/cdn'

// --- 移动端 ---
const isMobile = ref(window.matchMedia('(max-width: 768px)').matches)
const isCompact = ref(window.matchMedia('(max-width: 1200px)').matches) // 小屏/平板紧凑缩放
function detectMobile() {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
  isCompact.value = window.matchMedia('(max-width: 1200px)').matches
}

// --- 展开/收起状态 ---
const isExpanded = ref(false)
const backgroundLayerRef = ref<InstanceType<typeof BackgroundLayer> | null>(null)

// --- 音乐状态（驱动 MagicRings 参数） ---
const router = useRouter()
const musicStore = useMusicStore()
const theme = useThemeStore()
const petEnv = usePetEnvStore()
const showCRT = ref(false)

function onPetRage() {
  showCRT.value = true
  setTimeout(() => {
    router.push('/404')
  }, 900)
}

// 桌宠实例：中指手势激怒时调用其 provoke（进 threat 约 1 秒后暴怒）
// 因为使用了 PetSwitcher 包装，类型改为 PetSwitcher
const petRef = ref<InstanceType<typeof PetSwitcher> | null>(null)
function onMiddleFinger() {
  petRef.value?.provoke()
}

// 竖食指横扫 → 以当前桌宠中心为起点，圆形扩散切换主题
function onSwipe() {
  const c = petRef.value?.getPetCenter?.() ?? { x: window.innerWidth / 2, y: 80 }
  theme.toggle(c.x, c.y, outgoingBackgroundIndex.value !== null)
}

// 睁眼动画（仅亮色）
const showEye = ref(false)
const eyeSrc = ref('/assets/eyes/e1.png')
const eyeSharp = ref(false)
let eyeTimers: ReturnType<typeof setTimeout>[] = []
function clearEyeTimers() {
  eyeTimers.forEach(clearTimeout)
  eyeTimers = []
  eyeSharp.value = false
}
function clearRageEffects() {
  clearEyeTimers()
  showEye.value = false
  rageShutdown.value = false
  eyeSharp.value = false
}
function onRageStart() {
  // === CRT 依次关机清场（亮暗通用）===
  clearEyeTimers()
  eyeTimers.push(setTimeout(() => (rageShutdown.value = true), 700))

  // === 睁眼动画（仅亮色主题）===
  if (theme.isDark) return
  // 立即预加载后续帧（趁延迟窗口拉取大图，避免切帧卡顿）
  ;['e2', 'e3', 'e4'].forEach((n) => {
    const img = new Image()
    img.src = `/assets/eyes/${n}.png`
  })
  // 眼睛变清晰
  eyeTimers.push(setTimeout(() => (eyeSharp.value = true), 2300))
  // 头像先消失 0.3s；延迟后开始睁眼
  eyeTimers.push(
    setTimeout(() => {
      eyeSrc.value = '/assets/eyes/e1.png'
      showEye.value = true
      eyeTimers.push(
        setTimeout(() => (eyeSrc.value = '/assets/eyes/e2.png'), 550),
        setTimeout(() => (eyeSrc.value = '/assets/eyes/e3.png'), 570),
        setTimeout(() => (eyeSrc.value = '/assets/eyes/e4.png'), 600),
        setTimeout(() => (showEye.value = false), 2000),
      )
    }, 1800),
  )
}

const ringsOpacity = computed(() => isExpanded.value && !rageShutdown.value ? 0.5 : 0)

// 魔法环参数 — 有实际音频信号才变化（与桌宠唱歌、音频可视化共用 hasSignal）
const { hasSignal, startSignalCheck, stopSignalCheck } = useAudioAnalyzer()
const ringsSpeed = ref(0.7)
const ringsBaseRadius = ref(0.18)
const isAnimating = ref(false)
let ringsTargetSpeed = 0.7
let ringsTargetRadius = 0.18
let ringsSmoothId: number | null = null

function setRingsTarget(active: boolean) {
  ringsTargetSpeed = active ? 1 : 0.7
  ringsTargetRadius = active ? 0.35 : 0.18
  if (!ringsSmoothId) {
    ringsSmoothId = requestAnimationFrame(function tick() {
      ringsSpeed.value += (ringsTargetSpeed - ringsSpeed.value) * 0.05
      ringsBaseRadius.value += (ringsTargetRadius - ringsBaseRadius.value) * 0.05
      if (Math.abs(ringsTargetSpeed - ringsSpeed.value) > 0.001 || Math.abs(ringsTargetRadius - ringsBaseRadius.value) > 0.001) {
        ringsSmoothId = requestAnimationFrame(tick)
      } else {
        ringsSmoothId = null
      }
    })
  }
}

watch(() => musicStore.isPlaying, (playing) => {
  if (playing) startSignalCheck()
  else { stopSignalCheck(); setRingsTarget(false) }
})

watch(hasSignal, (active) => {
  if (musicStore.isPlaying) setRingsTarget(active)
})

const EXPAND_TOTAL = 1400 + 720 + 800
const COLLAPSE_TOTAL = 700
const isCollapsing = ref(false)
const rageShutdown = ref(false) // CRT 依次关机清场：各卡片用关机特效依次消失

function toggle(fromAvatar = false) {
  if (isAnimating.value) return
  isAnimating.value = true

  if (isExpanded.value) {
    isCollapsing.value = true
    petEnv.isCollapsing = true
    setTimeout(() => {
      isExpanded.value = false
      isCollapsing.value = false
      petEnv.isCollapsing = false
      isAnimating.value = false
    }, COLLAPSE_TOTAL)
    localStorage.setItem('home_expanded', '0')
  } else {
    if (fromAvatar) backgroundLayerRef.value?.triggerCenterRipple()
    isExpanded.value = true
    localStorage.setItem('home_expanded', '1')
    setTimeout(() => {
      isAnimating.value = false
    }, EXPAND_TOTAL)
  }
}

const avatarSpinClass = computed(() => {
  if (!isAnimating.value || isCollapsing.value) return ''
  return 'spin-forward'
})

// 收起动画：各区域朝中心方向移动（5 个独立 keyframe）
function regionCollapseClass(idx: number): string {
  if (!isCollapsing.value) return ''
  return `collapse-${idx}`
}

function onResize() {
  detectMobile()
}

// 背景轮播
const deferredBackgroundPreloads: HTMLImageElement[] = []
const backgroundIndex = ref(0)
const outgoingBackgroundIndex = ref<number | null>(null)

const BACKGROUND_HOLD_MS = 12_000
const BACKGROUND_TRANSITION_MS = 1_800
let backgroundCarouselTimer: ReturnType<typeof setTimeout> | null = null
let backgroundTransitionTimer: ReturnType<typeof setTimeout> | null = null

function scheduleBackgroundAdvance() {
  if (BACKGROUND_IMAGE_COUNT < 2) return
  backgroundCarouselTimer = setTimeout(advanceBackground, BACKGROUND_HOLD_MS)
}

function advanceBackground() {
  outgoingBackgroundIndex.value = backgroundIndex.value
  backgroundIndex.value = (backgroundIndex.value + 1) % BACKGROUND_IMAGE_COUNT
  backgroundTransitionTimer = setTimeout(() => {
    outgoingBackgroundIndex.value = null
    scheduleBackgroundAdvance()
  }, BACKGROUND_TRANSITION_MS)
}

function preloadDeferredBackgrounds() {
  getDeferredBackgroundPaths(theme.isDark).forEach((localSrc) => {
    const image = new Image()
    image.src = getImageUrl(localSrc) // CDN 优先，不可达时返回本地路径
    deferredBackgroundPreloads.push(image)
  })
}

onMounted(() => {
  detectMobile()
  window.addEventListener('resize', onResize)
  if (!isMobile.value) {
    preloadDeferredBackgrounds()
    scheduleBackgroundAdvance()
  }
  // 记住展开状态：上次展开 → 自动展开
  if (localStorage.getItem('home_expanded') === '1' && !isMobile.value) {
    setTimeout(() => toggle(true), 1500)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (backgroundCarouselTimer) clearTimeout(backgroundCarouselTimer)
  if (backgroundTransitionTimer) clearTimeout(backgroundTransitionTimer)
  if (ringsSmoothId) cancelAnimationFrame(ringsSmoothId)
  stopSignalCheck()
  clearRageEffects()
})

const componentListMobile = [
  DeviceStatus,
  BlogUpdates,
] as const
</script>

<template>
  <main class="relative w-full min-h-dvh overflow-hidden bg-background isolate">
    <BackgroundLayer
      ref="backgroundLayerRef"
      v-if="!theme.isDark"
      :current-index="backgroundIndex"
      :outgoing-index="outgoingBackgroundIndex"
      :artwork-enabled="!isMobile"
      :rings-opacity="ringsOpacity"
      :rings-speed="ringsSpeed"
      :rings-base-radius="ringsBaseRadius"
    />
    <GalaxyBackground
      v-else
      :current-index="backgroundIndex"
      :outgoing-index="outgoingBackgroundIndex"
    />
    <!-- 睁眼动画（仅亮色；图层在背景之上、内容之下，不遮挡内容） -->
    <img v-if="showEye" :src="eyeSrc" :class="['rage-eye', { sharp: eyeSharp }]" alt="" aria-hidden="true" />
    <ThemeToggle :fade-carousel-art="outgoingBackgroundIndex !== null" />
    <AdminAuth />
    <GestureToggle
      v-if="!isMobile"
      @palm="!isExpanded && toggle()"
      @pinch="isExpanded && toggle()"
      @snap="musicStore.togglePlay()"
      @middle-finger="onMiddleFinger"
      @swipe="onSwipe"
    />
    <!-- 折叠期间保持挂载（isExpanded || isCollapsing），卡片坍塌动画结束后一起移除 -->
    <PetSwitcher ref="petRef" v-if="isExpanded || isCollapsing" @rage="onPetRage" @rage-start="onRageStart" />
    <CRTShutdown :show="showCRT" />

    <!-- 桌面端：5 区域环绕 -->
    <template v-if="!isMobile">
      <!-- 音频可视化：环形频谱，环住头像 -->
      <div v-if="!rageShutdown" class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <AudioVisualizer :size="360" :inner-radius="72" :bar-max-length="75" />
      </div>

      <!-- 中心头像 + 名称简介（名称在上方发光，简介在下方） -->
      <div v-if="!rageShutdown" class="absolute top-1/2 left-1/2 w-0 h-0 z-30">
        <div
          class="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 avatar-eye-fade"
          :class="{ 'is-faded': showEye }"
        >
          <div :class="['avatar-spin-layer', avatarSpinClass]">
            <AvatarCore :size="110" @click="toggle(true)" />
          </div>
        </div>
        <!-- 名称：头像上方，大号发光（位置用 CSS class 定位，不用 inline style，否则 transition 无法覆盖） -->
        <Transition name="name-up">
          <div v-if="!isExpanded" class="name-label absolute top-0 left-1/2 pointer-events-none select-none whitespace-nowrap">
            <p class="font-script text-[66px] tracking-wider text-brand-sky-bright"
               style="text-shadow: 0 0 12px hsl(var(--color-sky) / 0.6), 0 0 30px hsl(var(--color-sky) / 0.35), 0 0 60px hsl(var(--color-sky) / 0.15), 0 2px 4px rgba(0,0,0,0.15);">
              DrTonks
            </p>
          </div>
        </Transition>
        <!-- 简介：头像下方 -->
        <Transition name="intro-fade">
          <div v-if="!isExpanded" class="bio-label absolute top-0 left-1/2 pointer-events-none select-none whitespace-nowrap">
            <p class="bio-copy text-[20px] tracking-wider text-brand-sky-deep" style="font-family: KaiTi, STKaiti, serif;">将点滴的美好谱写成诗</p>
          </div>
        </Transition>
      </div>

      <!-- 区域 0：左上（热力图 + 技术栈） -->
      <div class="region-anchor region-tl">
        <div
          :class="['region-inner', { visible: isExpanded && !rageShutdown, 'interaction-disabled': !isExpanded || isCollapsing || rageShutdown, 'shutting-down': rageShutdown }, regionCollapseClass(0)]"
          :inert="!isExpanded || isCollapsing || rageShutdown"
          :aria-hidden="!isExpanded || isCollapsing || rageShutdown"
          style="--shutdown-delay: 0ms"
        >
          <div class="flex gap-3">
            <HeatmapPanel :compact="isCompact" />
            <LanguagePanel v-if="!isCompact" />
          </div>
        </div>
      </div>

      <!-- 区域 1：左下（日历 bento：左月视图 | 右 星期+节日+待办，等高） -->
      <div class="region-anchor region-bl">
        <div
          :class="['region-inner', { visible: isExpanded && !rageShutdown, 'interaction-disabled': !isExpanded || isCollapsing || rageShutdown, 'shutting-down': rageShutdown }, regionCollapseClass(1)]"
          :inert="!isExpanded || isCollapsing || rageShutdown"
          :aria-hidden="!isExpanded || isCollapsing || rageShutdown"
          style="--shutdown-delay: 150ms"
        >
          <div class="flex gap-3 items-stretch">
            <CalendarMonth />
            <div v-if="!isCompact" class="flex flex-col gap-2 flex-1">
              <TodayCard class="flex-1" />
              <UpcomingHolidays class="flex-1" />
              <TodoList class="flex-1" />
            </div>
          </div>
        </div>
      </div>

      <!-- 区域 2：中下（博客） -->
      <div class="region-anchor region-bc">
        <div
          :class="['region-inner', { visible: isExpanded && !rageShutdown, 'interaction-disabled': !isExpanded || isCollapsing || rageShutdown, 'shutting-down': rageShutdown }, regionCollapseClass(2)]"
          :inert="!isExpanded || isCollapsing || rageShutdown"
          :aria-hidden="!isExpanded || isCollapsing || rageShutdown"
          style="--shutdown-delay: 300ms"
        >
          <BlogUpdates :article-count="isCompact ? 2 : 3" />
        </div>
      </div>

      <!-- 区域 3：右下（胶片 + 控制） -->
      <div class="region-anchor region-br">
        <div
          :class="['region-inner', { visible: isExpanded && !rageShutdown, 'interaction-disabled': !isExpanded || isCollapsing || rageShutdown, 'shutting-down': rageShutdown }, regionCollapseClass(3)]"
          :inert="!isExpanded || isCollapsing || rageShutdown"
          :aria-hidden="!isExpanded || isCollapsing || rageShutdown"
          style="--shutdown-delay: 450ms"
        >
          <div class="flex gap-3 items-center">
            <MusicVinyl v-if="!isCompact" />
            <MusicControls :is-compact="isCompact" />
          </div>
        </div>
      </div>

      <!-- 区域 4：右上（设备状态） -->
      <div class="region-anchor region-tr">
        <div
          :class="['region-inner', { visible: isExpanded && !rageShutdown, 'interaction-disabled': !isExpanded || isCollapsing || rageShutdown, 'shutting-down': rageShutdown }, regionCollapseClass(4)]"
          :inert="!isExpanded || isCollapsing || rageShutdown"
          :aria-hidden="!isExpanded || isCollapsing || rageShutdown"
          style="--shutdown-delay: 600ms"
        >
          <DeviceStatus />
        </div>
      </div>
    </template>

    <!-- 移动端：纵向卡片栈 + 背景图（暗色隐藏照片，露出 Galaxy 星空） -->
    <div
      v-else
      class="relative min-h-dvh flex flex-col items-center gap-4 px-4 py-8 sm:py-12"
      :style="theme.isDark ? undefined : { background: `url('/assets/ph-bg.jpg') center/cover no-repeat` }"
    >
      <template v-if="!rageShutdown">
        <AvatarCore :size="80" />
        <div class="w-[calc(100%-2rem)] flex flex-col gap-4 mt-2 [&>*]:!w-full">
          <component v-for="(C, i) in componentListMobile" :key="i" :is="C" />
        </div>
      </template>
    </div>

    <!-- 提示文字 -->
    <Transition name="fade">
      <div
        v-if="!isMobile && !isExpanded && !rageShutdown"
        class="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground/85 tracking-[0.2em] uppercase pointer-events-none z-30"
      >
        点击头像展开 · Click to expand
      </div>
    </Transition>

  </main>
</template>

<style scoped>
/* ===== 老普睁眼（背景之上、内容之下） ===== */
.rage-eye {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(200vh, 200vw);
  height: auto;
  z-index: -5;
  opacity: 0;
  filter: blur(6px);
  pointer-events: none;
  animation: rage-eye-in 0.7s ease-out forwards;
  /* t=2.3s 渐变：blur 渐变(0.3s) + opacity 渐变(0.5s) */
  transition: filter 0.3s ease-out, opacity 0.5s ease-out;
}
.rage-eye.sharp {
  filter: blur(4px);
  opacity: 0.5 !important; /* 覆盖 @keyframes 动画的 opacity（动画优先级 > 普通声明） */
}
@keyframes rage-eye-in {
  to { opacity: 0.3; }
}
/* 睁眼时中央头像同步 0.3s 渐隐，避免遮住瞳孔 */
.avatar-eye-fade {
  transition: opacity 0.3s ease-out;
}
.avatar-eye-fade.is-faded {
  opacity: 0;
}

/* ===== 头像自转 ===== */
.avatar-spin-layer {
  will-change: transform;
}
.avatar-spin-layer.spin-forward {
  animation: spin-forward 1.4s cubic-bezier(0.37, 0, 0.63, 1) forwards;
}
.avatar-spin-layer.spin-backward {
  animation: spin-backward 0.7s cubic-bezier(0.37, 0, 0.63, 1) forwards;
}
@keyframes spin-forward {
  from { transform: rotate(0deg); }
  to   { transform: rotate(-360deg); }
}
@keyframes spin-backward {
  from { transform: rotate(-360deg); }
  to   { transform: rotate(0deg); }
}

/* ===== 区域定位 =====
   每个区域用 top/left/right/bottom 锚定到四角 + 中下
*/
.region-anchor {
  position: absolute;
  z-index: 20;
}
.region-tl { bottom: 60%; right: 53%; }
.region-tr { bottom: 55%; left: 60%; }
.region-bl { top: 55%; right: 63%; }
.region-bc { top: 60%; left: 50%; }
.region-br { top: 53%; left: 66%; }

/* ===== 响应式紧凑：≤1200px 等比缩小 + 更紧凑的间距 ===== */
@media (max-width: 1200px) {
  .region-anchor {
    transform: scale(0.88);
  }
  /* 往中心收紧间距（缩小 right/left,放大 bottom/top = 更接近中心） */
  .region-tl { bottom: 55%; right: 55%; }
  .region-tr { bottom: 58%; left: 56%; }
  .region-bl { top: 50%; right: 65%; }
  .region-bc { top: 60%; left: 49%; }
  .region-br { top: 48%; left: 68%; }
  /* 动画偏移量缩小 */
  .region-tl .region-inner {
    --init-x: clamp(60px, 10vw, 140px);
    --init-y: clamp(50px, 8vw, 120px);
  }
  .region-bl .region-inner {
    --init-x: clamp(40px, 8vw, 100px);
    --init-y: calc(-1 * clamp(40px, 8vw, 100px));
  }
  .region-bc .region-inner {
    --init-y: calc(-1 * clamp(40px, 8vw, 100px));
  }
  .region-br .region-inner {
    --init-x: calc(-1 * clamp(40px, 8vw, 100px));
    --init-y: calc(-1 * clamp(40px, 8vw, 100px));
  }
  .region-tr .region-inner {
    --init-x: calc(-1 * clamp(40px, 8vw, 100px));
    --init-y: clamp(40px, 8vw, 100px);
  }
}

/* ===== 区域动画层 =====
   父层只负责位移/缩放；透明度放在玻璃卡片自身，避免父层 opacity 隔断 backdrop-filter。
   初始：朝中心方向偏移 + scale(0.3)，内部卡片 opacity(0)
   展开：归位 + scale(1)，内部卡片 opacity(1)
   延迟：左上 0 → 左下 180 → 中下 360 → 右下 540 → 右上 720
*/
.region-inner {
  opacity: 1;
  pointer-events: none;
  transform: translate(var(--init-x, 0px), var(--init-y, 0px)) scale(0.3);
  transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  transition-delay: var(--delay, 0ms);
}
.region-inner :deep(.card-3d) {
  opacity: 0;
  transition:
    transform 0.4s cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 0.45s ease-out,
    opacity 0.6s ease-out;
  transition-delay: 0ms, 0ms, var(--delay, 0ms);
}
.region-inner.visible {
  pointer-events: auto;
  transform: translate(0, 0) scale(1);
}
.region-inner.visible :deep(.card-3d) {
  opacity: 1;
}
.region-inner.interaction-disabled {
  pointer-events: none;
}
.region-inner.interaction-disabled :deep(.card-3d) {
  opacity: 0;
  transition-delay: 0ms;
}
/* CRT 关机特效：父层负责收缩，卡片自身负责亮度与透明度，避免中断背景模糊。 */
.region-inner.shutting-down {
  animation: card-crt-motion 0.55s ease-in forwards;
  animation-delay: var(--shutdown-delay, 0ms);
}
.region-inner.shutting-down :deep(.card-3d) {
  animation: card-crt-surface 0.55s ease-in forwards;
  animation-delay: var(--shutdown-delay, 0ms);
}
@keyframes card-crt-motion {
  0%   { transform: translate(0,0) scale(1); }
  10%  { transform: translate(0,0) scale(1); }
  14%  { transform: translate(0,0) scale(1.02); }
  18%  { transform: translate(0,0) scale(1.02); }
  22%  { transform: translate(0,0) scale(1.01); }
  28%  { transform: translate(0,0) scale(1.02); }
  45%  { transform: translate(0,0) scale(0.94); }
  75%  { transform: scale(0.35); }
  100% { transform: scale(0.08); }
}
@keyframes card-crt-surface {
  0%   { opacity: 1; filter: brightness(1); }
  10%  { opacity: 1; filter: brightness(6); }
  14%  { opacity: 1; filter: brightness(2.5); }
  18%  { opacity: 1; filter: brightness(7); }
  22%  { opacity: 0.9; filter: brightness(1.2); }
  28%  { opacity: 1; filter: brightness(4.5); }
  45%  { opacity: 0.7; filter: brightness(1); }
  75%  { opacity: 0.25; filter: brightness(0.4); }
  100% { opacity: 0; filter: brightness(0); }
}

/* 每个区域的"朝中心偏移"方向 + 延迟
   偏移量：clamp(80px, 12vw, 180px)，朝中心方向
*/
.region-tl .region-inner {
  --init-x: clamp(120px, 16vw, 240px);   /* 朝右下（中心方向） */
  --init-y: clamp(100px, 14vw, 200px);
  --delay: 0ms;
}
.region-bl .region-inner {
  --init-x: clamp(80px, 12vw, 180px);   /* 朝右上 */
  --init-y: calc(-1 * clamp(80px, 12vw, 180px));
  --delay: 180ms;
}
.region-bc .region-inner {
  --init-x: 0px;                         /* 朝正上 */
  --init-y: calc(-1 * clamp(80px, 12vw, 180px));
  --delay: 360ms;
  /* 中下区域需要 translateX(-50%) 居中，并入 transform */
  transform: translateX(-50%) translate(0, var(--init-y)) scale(0.3);
}
.region-bc .region-inner.visible {
  transform: translateX(-50%) translate(0, 0) scale(1);
}
.region-br .region-inner {
  --init-x: calc(-1 * clamp(80px, 12vw, 180px));  /* 朝左上 */
  --init-y: calc(-1 * clamp(80px, 12vw, 180px));
  --delay: 540ms;
}
.region-tr .region-inner {
  --init-x: calc(-1 * clamp(80px, 12vw, 180px));  /* 朝左下 */
  --init-y: clamp(80px, 12vw, 180px);
  --delay: 720ms;
}

/* ===== 通用过渡 ===== */
/* 名称/简介 固定位置（用 CSS class，不用 inline style，否则 Vue transition 无法动画 transform） */
.name-label  { transform: translate(-50%, -200px); }
.bio-label   { transform: translate(-50%, 120px); }
.bio-copy    { text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8); }
:global(.dark) .bio-copy { text-shadow: none; }

/* 名称：向上偏移消失 + 下方重新出现 */
.name-up-leave-active {
  transition: all 0.5s ease-in !important;
}
.name-up-leave-to {
  opacity: 0 !important;
  transform: translate(-50%, -260px) !important;
}
.name-up-enter-active {
  transition: all 0.4s ease-out 0.2s;
}
.name-up-enter-from {
  opacity: 0;
  transform: translate(-50%, -160px);
}

/* 简介 */
.intro-fade-leave-active {
  transition: all 0.4s ease-in !important;
}
.intro-fade-leave-to {
  opacity: 0 !important;
  transform: translate(-50%, 180px) !important;
}
.intro-fade-enter-active {
  transition: all 1s ease-out 0.2s;
}
.intro-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, 150px);
}

/* 收起: 5 个区域各自朝中心方向移动 + 缩放消失 */
/* 0=左上(热力图) -> 右下 */
.collapse-0 { animation: col-tl 0.6s ease-in forwards; }
@keyframes col-tl {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(20rem, 10rem) scale(0.2); }
}
/* 1=左下(日历) -> 右上 */
.collapse-1 { animation: col-bl 0.6s ease-in forwards; }
@keyframes col-bl {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(25rem, -15rem) scale(0.2); }
}
/* 2=中下(博客) -> 正上 */
.collapse-2 { animation: col-bc 0.6s ease-in forwards; }
@keyframes col-bc {
  from { transform: translate(-50%, 0) scale(1); }
  to   { transform: translate(-50%, -7rem) scale(0.2); }
}
/* 3=右下(音乐) -> 左上 */
.collapse-3 { animation: col-br 0.6s ease-in forwards; }
@keyframes col-br {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(-20rem, -10rem) scale(0.2); }
}
/* 4=右上(设备) -> 左下 */
.collapse-4 { animation: col-tr 0.6s ease-in forwards; }
@keyframes col-tr {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(-10rem, 10rem) scale(0.2); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-out);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .region-inner,
  .region-inner.visible {
    transition: none;
    transition-delay: 0ms;
  }
  .region-inner :deep(.card-3d) {
    transition: none;
    transition-delay: 0ms;
  }
  .avatar-spin-layer.spin-forward,
  .avatar-spin-layer.spin-backward {
    animation: none;
  }
}
</style>
