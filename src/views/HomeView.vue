<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import AvatarCore from '@/components/layout/AvatarCore.vue'
import BackgroundLayer from '@/components/layout/BackgroundLayer.vue'
import DesktopPet from '@/components/layout/DesktopPet.vue'
import CRTShutdown from '@/components/layout/CRTShutdown.vue'
import { AdminAuth } from '@/components/auth'
import { GestureToggle } from '@/components/gesture'
import { DeviceStatus } from '@/components/device'
import { BlogUpdates } from '@/components/blog'
import { HeatmapPanel, LanguagePanel } from '@/components/heatmap'
import { useMusicStore } from '@/stores/music'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'
import { CalendarMonth, TodayCard, UpcomingHolidays, TodoList } from '@/components/calendar'
import { MusicVinyl, MusicControls } from '@/components/music'
import AudioVisualizer from '@/components/music/AudioVisualizer.vue'

// --- 移动端 ---
const isMobile = ref(false)
function detectMobile() {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
}

// --- 展开/收起状态 ---
const isExpanded = ref(false)

// --- 音乐状态（驱动 MagicRings 参数） ---
const router = useRouter()
const musicStore = useMusicStore()
const showCRT = ref(false)

function onPetRage() {
  showCRT.value = true
  setTimeout(() => {
    router.push('/404')
  }, 900)
}
const ringsOpacity = computed(() => isExpanded.value ? 0.5 : 0)

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

function toggle() {
  if (isAnimating.value) return
  isAnimating.value = true

  if (isExpanded.value) {
    isCollapsing.value = true
    setTimeout(() => {
      isExpanded.value = false
      isCollapsing.value = false
      isAnimating.value = false
    }, COLLAPSE_TOTAL)
    localStorage.setItem('home_expanded', '0')
  } else {
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

// 全局微 3D（±1° 极轻）
const mainRef = ref<HTMLElement | null>(null)
function onGlobalMouseMove(e: MouseEvent) {
  if (!mainRef.value || isMobile.value) return
  const cx = window.innerWidth / 2
  const cy = window.innerHeight / 2
  const gx = ((e.clientX - cx) / cx * 1).toFixed(3)
  const gy = ((e.clientY - cy) / cy * 1).toFixed(3)
  mainRef.value.style.setProperty('--gx', gx)
  mainRef.value.style.setProperty('--gy', gy)
}

onMounted(() => {
  detectMobile()
  window.addEventListener('resize', onResize)
  if (!isMobile.value) {
    window.addEventListener('mousemove', onGlobalMouseMove)
  }
  // 记住展开状态：上次展开 → 自动展开
  if (localStorage.getItem('home_expanded') === '1' && !isMobile.value) {
    setTimeout(() => toggle(), 1000)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('mousemove', onGlobalMouseMove)
  if (ringsSmoothId) cancelAnimationFrame(ringsSmoothId)
})

const componentListMobile = [
  DeviceStatus,
  BlogUpdates,
] as const
</script>

<template>
  <main ref="mainRef" class="relative w-full min-h-dvh overflow-hidden bg-background isolate global-3d">
    <BackgroundLayer
      :rings-opacity="ringsOpacity"
      :rings-speed="ringsSpeed"
      :rings-base-radius="ringsBaseRadius"
    />
    <AdminAuth />
    <GestureToggle
      v-if="!isMobile"
      @palm="!isExpanded && toggle()"
      @pinch="isExpanded && toggle()"
      @snap="musicStore.togglePlay()"
    />
    <Transition name="pet-fade">
      <DesktopPet v-if="isExpanded && !isCollapsing" @rage="onPetRage" />
    </Transition>
    <CRTShutdown :show="showCRT" />

    <!-- 桌面端：5 区域环绕 -->
    <template v-if="!isMobile">
      <!-- 音频可视化：环形频谱，环住头像 -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
        <AudioVisualizer :size="360" :inner-radius="72" :bar-max-length="75" />
      </div>

      <!-- 中心头像 + 名称简介（名称在上方发光，简介在下方） -->
      <div class="absolute top-1/2 left-1/2 w-0 h-0 z-30 global-tilt">
        <div class="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
          <div :class="['avatar-spin-layer', avatarSpinClass]">
            <AvatarCore :size="110" @click="toggle" />
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
            <p class="text-[20px] tracking-wider text-brand-mint-deep" style="font-family: KaiTi, STKaiti, serif;">将点滴的美好谱写成诗</p>
          </div>
        </Transition>
      </div>

      <!-- 区域 0：左上（热力图 + 技术栈） -->
      <div class="region-anchor region-tl global-tilt">
        <div :class="['region-inner', { visible: isExpanded }, regionCollapseClass(0)]">
          <div class="flex gap-3">
            <HeatmapPanel />
            <LanguagePanel />
          </div>
        </div>
      </div>

      <!-- 区域 1：左下（日历 bento：左月视图 | 右 星期+节日+待办，等高） -->
      <div class="region-anchor region-bl global-tilt">
        <div :class="['region-inner', { visible: isExpanded }, regionCollapseClass(1)]">
          <div class="flex gap-3 items-stretch">
            <CalendarMonth />
            <div class="flex flex-col gap-2 flex-1">
              <TodayCard class="flex-1" />
              <UpcomingHolidays class="flex-1" />
              <TodoList class="flex-1" />
            </div>
          </div>
        </div>
      </div>

      <!-- 区域 2：中下（博客） -->
      <div class="region-anchor region-bc global-tilt">
        <div :class="['region-inner', { visible: isExpanded }, regionCollapseClass(2)]">
          <BlogUpdates />
        </div>
      </div>

      <!-- 区域 3：右下（胶片 + 控制） -->
      <div class="region-anchor region-br global-tilt">
        <div :class="['region-inner', { visible: isExpanded }, regionCollapseClass(3)]">
          <div class="flex gap-3 items-center">
            <MusicVinyl />
            <MusicControls />
          </div>
        </div>
      </div>

      <!-- 区域 4：右上（设备状态） -->
      <div class="region-anchor region-tr">
        <div :class="['region-inner', { visible: isExpanded }, regionCollapseClass(4)]">
          <DeviceStatus />
        </div>
      </div>
    </template>

    <!-- 移动端：纵向卡片栈 + 背景图 -->
    <div
      v-else
      class="relative min-h-dvh flex flex-col items-center gap-4 px-4 py-8 sm:py-12"
      style="background: url('/assets/ph-bg.jpg') center/cover no-repeat;"
    >
      <AvatarCore :size="80" />
      <div class="w-[calc(100%-2rem)] flex flex-col gap-4 mt-2 [&>*]:!w-full">
        <component v-for="(C, i) in componentListMobile" :key="i" :is="C" />
      </div>
    </div>

    <!-- 提示文字 -->
    <Transition name="fade">
      <div
        v-if="!isMobile && !isExpanded"
        class="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground/85 tracking-[0.2em] uppercase pointer-events-none z-30"
      >
        点击头像展开 · Click to expand
      </div>
    </Transition>

  </main>
</template>

<style scoped>
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

/* ===== 区域动画层 =====
   初始：朝中心方向偏移 + scale(0.3) + opacity(0)
   展开：归位 + scale(1) + opacity(1)
   延迟：左上 0 → 左下 180 → 中下 360 → 右下 540 → 右上 720
*/
.region-inner {
  opacity: 0;
  transform: translate(var(--init-x, 0px), var(--init-y, 0px)) scale(0.3);
  transition:
    transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.6s ease-out;
  transition-delay: var(--delay, 0ms);
  will-change: transform, opacity;
}
.region-inner.visible {
  opacity: 1;
  transform: translate(0, 0) scale(1);
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
  from { opacity: 1; transform: translate(0, 0) scale(1); }
  to   { opacity: 0; transform: translate(20rem, 10rem) scale(0.2); }
}
/* 1=左下(日历) -> 右上 */
.collapse-1 { animation: col-bl 0.6s ease-in forwards; }
@keyframes col-bl {
  from { opacity: 1; transform: translate(0, 0) scale(1); }
  to   { opacity: 0; transform: translate(25rem, -15rem) scale(0.2); }
}
/* 2=中下(博客) -> 正上 */
.collapse-2 { animation: col-bc 0.6s ease-in forwards; }
@keyframes col-bc {
  from { opacity: 1; transform: translate(-50%, 0) scale(1); }
  to   { opacity: 0; transform: translate(-50%, -7rem) scale(0.2); }
}
/* 3=右下(音乐) -> 左上 */
.collapse-3 { animation: col-br 0.6s ease-in forwards; }
@keyframes col-br {
  from { opacity: 1; transform: translate(0, 0) scale(1); }
  to   { opacity: 0; transform: translate(-20rem, -10rem) scale(0.2); }
}
/* 4=右上(设备) -> 左下 */
.collapse-4 { animation: col-tr 0.6s ease-in forwards; }
@keyframes col-tr {
  from { opacity: 1; transform: translate(0, 0) scale(1); }
  to   { opacity: 0; transform: translate(-10rem, 10rem) scale(0.2); }
}

/* 桌宠淡出 */
.pet-fade-leave-active {
  transition: opacity 0.5s ease-in;
}
.pet-fade-leave-to {
  opacity: 0;
}

/* 全局微 3D */
.global-3d {
  --gx: 0;
  --gy: 0;
  transform-style: preserve-3d;
  perspective: 2000px;
}
.global-tilt {
  transform: rotateY(calc(var(--gx) * -4deg)) rotateX(calc(var(--gy) * 3deg));
  transition: transform 1.2s cubic-bezier(0.23, 1, 0.32, 1);
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
  .avatar-spin-layer.spin-forward,
  .avatar-spin-layer.spin-backward {
    animation: none;
  }
}
</style>
