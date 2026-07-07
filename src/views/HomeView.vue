<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import AvatarCore from '@/components/layout/AvatarCore.vue'
import BackgroundLayer from '@/components/layout/BackgroundLayer.vue'
import { AdminAuth } from '@/components/auth'
import { GestureToggle } from '@/components/gesture'
import { DeviceStatus } from '@/components/device'
import { BlogUpdates } from '@/components/blog'
import { HeatmapPanel, LanguagePanel } from '@/components/heatmap'
import { CalendarMonth, TodayCard, UpcomingHolidays, TodoList } from '@/components/calendar'
import { MusicVinyl, MusicControls } from '@/components/music'

// --- 移动端 ---
const isMobile = ref(false)
function detectMobile() {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
}

// --- 展开/收起状态 ---
const isExpanded = ref(false)
const isAnimating = ref(false)

// 展开总时长 = 头像旋转 + 最后区域延迟 + 单区域过渡
const EXPAND_TOTAL = 1400 + 720 + 800
const COLLAPSE_TOTAL = 700 + 4 * 60 + 700

const bgRef = ref<InstanceType<typeof BackgroundLayer> | null>(null)

function toggle() {
  if (isAnimating.value) return
  isAnimating.value = true
  isExpanded.value = !isExpanded.value
  if (isExpanded.value) {
    bgRef.value?.scatter()
  }
  const total = isExpanded.value ? EXPAND_TOTAL : COLLAPSE_TOTAL
  setTimeout(() => {
    isAnimating.value = false
  }, total)
}

// 头像旋转 class
const avatarSpinClass = computed(() => {
  if (!isAnimating.value) return ''
  return isExpanded.value ? 'spin-forward' : 'spin-backward'
})

function onResize() {
  detectMobile()
}

onMounted(() => {
  detectMobile()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

const componentListMobile = [
  HeatmapPanel,
  LanguagePanel,
  DeviceStatus,
  CalendarMonth,
  TodayCard,
  UpcomingHolidays,
  TodoList,
  BlogUpdates,
  MusicVinyl,
  MusicControls,
] as const
</script>

<template>
  <main class="relative w-full min-h-dvh overflow-hidden bg-background isolate">
    <BackgroundLayer ref="bgRef" />
    <AdminAuth />
    <GestureToggle v-if="!isMobile" @palm="toggle" />

    <!-- 桌面端：5 区域环绕 -->
    <template v-if="!isMobile">
      <!-- 中心头像 -->
      <div class="absolute top-1/2 left-1/2 w-0 h-0 z-30">
        <div class="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2">
          <div :class="['avatar-spin-layer', avatarSpinClass]">
            <AvatarCore :size="110" @click="toggle" />
          </div>
        </div>
      </div>

      <!-- 区域 0：左上（热力图 + 技术栈） -->
      <div class="region-anchor region-tl">
        <div :class="['region-inner', { visible: isExpanded }]">
          <div class="flex gap-3">
            <HeatmapPanel />
            <LanguagePanel />
          </div>
        </div>
      </div>

      <!-- 区域 1：左下（日历 bento：左月视图 | 右 星期+节日+待办，等高） -->
      <div class="region-anchor region-bl">
        <div :class="['region-inner', { visible: isExpanded }]">
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
      <div class="region-anchor region-bc">
        <div :class="['region-inner', { visible: isExpanded }]">
          <BlogUpdates />
        </div>
      </div>

      <!-- 区域 3：右下（胶片 + 控制） -->
      <div class="region-anchor region-br">
        <div :class="['region-inner', { visible: isExpanded }]">
          <div class="flex gap-3 items-center">
            <MusicVinyl />
            <MusicControls />
          </div>
        </div>
      </div>

      <!-- 区域 4：右上（设备状态） -->
      <div class="region-anchor region-tr">
        <div :class="['region-inner', { visible: isExpanded }]">
          <DeviceStatus />
        </div>
      </div>
    </template>

    <!-- 移动端：纵向卡片栈 -->
    <div
      v-else
      class="relative min-h-dvh flex flex-col items-center gap-4 px-4 py-8 sm:py-12"
    >
      <AvatarCore :size="80" />
      <div class="w-full max-w-sm flex flex-col gap-4 mt-2">
        <component v-for="(C, i) in componentListMobile" :key="i" :is="C" />
      </div>
    </div>

    <!-- 提示文字 -->
    <Transition name="fade">
      <div
        v-if="!isMobile && !isExpanded"
        class="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground/70 tracking-[0.2em] uppercase pointer-events-none z-30"
      >
        点击头像展开 · Click to expand
      </div>
    </Transition>

    <!-- 收起按钮 -->
    <Transition name="fade">
      <button
        v-if="!isMobile && isExpanded"
        class="absolute top-6 right-6 text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md bg-card/60 backdrop-blur-sm border border-border/40 z-40"
        @click="toggle"
      >
        <span class="tracking-[0.15em] uppercase">收起</span>
      </button>
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
