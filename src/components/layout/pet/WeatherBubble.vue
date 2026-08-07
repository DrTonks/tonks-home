<script setup lang="ts">
/**
 * WeatherBubble — 天气信息气泡组件，独立于 SpeechBubble。
 *
 * 包含 CSS 动画天气图标（太阳旋转、雨滴下落、雪花飘落、云朵漂浮等）、
 * 城市/天气描述/温度/明日预报 + 关怀语打字机效果。
 */
import { ref, watch, onBeforeUnmount, computed } from 'vue'
import type { WeatherData, WeatherIcon } from '@/composables/useWeatherVisitor'

const props = withDefaults(
  defineProps<{
    visible?: boolean
    weatherData?: WeatherData | null
    placement?: 'left' | 'right'
    careText?: string
    /** 垂直偏移（px）：正=上移，负=下移。用 calc 而非 margin-top 避免双负号问题 */
    verticalOffset?: number
    /** 水平偏移（px）：气泡距离桌宠的水平间距，默认 8 */
    horizontalOffset?: number
  }>(),
  {
    visible: false,
    weatherData: null,
    placement: 'left',
    careText: '',
    verticalOffset: 14,
    horizontalOffset: 8,
  },
)

const emit = defineEmits<{ close: [] }>()

// ===== 打字机效果 =====
const displayedCareText = ref('')
const isTyping = ref(false)
let typeTimer: ReturnType<typeof setInterval> | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null

function startTypewriter(text: string) {
  stopTypewriter()
  if (!text) return
  displayedCareText.value = ''
  isTyping.value = true
  let i = 0
  typeTimer = setInterval(() => {
    displayedCareText.value = text.slice(0, i + 1)
    i++
    if (i >= text.length) {
      stopTypewriter()
      isTyping.value = false
    }
  }, 45)
}

function stopTypewriter() {
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null }
}

function resetDismissTimer() {
  if (dismissTimer) clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => emit('close'), 14_000)
}

watch(() => props.visible, (v) => {
  if (v) {
    resetDismissTimer()
    if (props.careText) startTypewriter(props.careText)
  } else {
    stopTypewriter()
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null }
    displayedCareText.value = ''
  }
})

watch(() => props.careText, (text) => {
  if (props.visible && text) startTypewriter(text)
})

onBeforeUnmount(() => {
  stopTypewriter()
  if (dismissTimer) clearTimeout(dismissTimer)
})

// ===== 天气图标类型 =====
const iconClass = computed(() => {
  if (!props.weatherData) return ''
  return `weather-icon--${props.weatherData.icon}`
})

// ===== 排版：内容 -> 图标 -> 信息 =====
</script>

<template>
  <Transition name="weather-pop">
    <div
      v-if="visible && weatherData"
      class="weather-bubble"
      :class="[`place-${placement}`]"
      :style="{
        top: `calc(-20% - ${verticalOffset}px)`,
        [placement === 'left' ? 'right' : 'left']: `calc(100% + ${horizontalOffset}px)`,
      }"
      @mousemove="resetDismissTimer"
    >
      <!-- 尾巴三角形 -->
      <div class="weather-tail" />

      <!-- 天气图标动画区 -->
      <div class="weather-icon" :class="iconClass">
        <!-- 晴：太阳 + 光晕 + 射线 -->
        <template v-if="weatherData.icon === 'sunny'">
          <div class="sun-core" />
          <div class="sun-rays"><span v-for="r in 8" :key="r" class="sun-ray" :style="{ '--i': r }" /></div>
        </template>

        <!-- 少云：小太阳 + 浅白薄云 -->
        <template v-else-if="weatherData.icon === 'partly-cloudy'">
          <div class="sun-core sun-core--small" />
          <div class="cloud-shape cloud-partly" style="top: 58%; left: 62%; transform: translate(-50%, -50%); animation-duration: 5s;">
            <div class="cloud-part cloud-main" />
            <div class="cloud-part cloud-bump-l" />
            <div class="cloud-part cloud-bump-r" />
          </div>
        </template>

        <!-- 多云/阴：云朵 -->
        <template v-else-if="weatherData.icon === 'cloudy' || weatherData.icon === 'fog'">
          <div class="cloud-shape">
            <div class="cloud-part cloud-main" />
            <div class="cloud-part cloud-bump-l" />
            <div class="cloud-part cloud-bump-r" />
          </div>
          <div v-if="weatherData.icon === 'fog'" class="fog-lines">
            <span v-for="l in 3" :key="l" class="fog-line" :style="{ '--i': l }" />
          </div>
        </template>

        <!-- 雨/阵雨：云 + 雨滴 -->
        <template v-else-if="weatherData.icon === 'rain' || weatherData.icon === 'shower'">
          <div class="cloud-shape cloud-above">
            <div class="cloud-part cloud-main" />
            <div class="cloud-part cloud-bump-l" />
            <div class="cloud-part cloud-bump-r" />
          </div>
          <div class="rain-drops">
            <span v-for="d in 5" :key="d" class="rain-drop" :style="{ '--i': d }" />
          </div>
        </template>

        <!-- 雪：浅色云 + 雪花 -->
        <template v-else-if="weatherData.icon === 'snow'">
          <div class="cloud-shape cloud-above cloud-light">
            <div class="cloud-part cloud-main" />
            <div class="cloud-part cloud-bump-l" />
            <div class="cloud-part cloud-bump-r" />
          </div>
          <div class="snow-flakes">
            <span v-for="s in 5" :key="s" class="snow-flake" :style="{ '--i': s }" />
          </div>
        </template>

        <!-- 雷暴：乌云 + 闪电 + 雨滴 -->
        <template v-else-if="weatherData.icon === 'thunder'">
          <div class="cloud-shape cloud-above cloud-dark">
            <div class="cloud-part cloud-main" />
            <div class="cloud-part cloud-bump-l" />
            <div class="cloud-part cloud-bump-r" />
          </div>
          <div class="lightning-glow" />
          <div class="lightning-bolt" />
          <div class="rain-drops">
            <span v-for="d in 4" :key="d" class="rain-drop" :style="{ '--i': d }" />
          </div>
        </template>
      </div>

      <!-- 天气信息文字区 -->
      <div class="weather-info">
        <div class="weather-city">{{ weatherData.city }}</div>
        <div class="weather-main">
          <span class="weather-desc">{{ weatherData.desc }}</span>
          <span class="weather-temp">{{ weatherData.temp }}°C</span>
        </div>
        <div class="weather-tomorrow">
          明天：{{ weatherData.tomorrow.desc }} {{ weatherData.tomorrow.tempMin }}~{{ weatherData.tomorrow.tempMax }}°C
        </div>
        <!-- 关怀语 -->
        <div v-if="displayedCareText" class="weather-care">
          {{ displayedCareText }}<span v-if="isTyping" class="care-cursor">|</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ===== 容器 ===== */
.weather-bubble {
  position: absolute;
  z-index: 63;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 230px;
  max-width: 280px;
  padding: 14px 16px;
  background: var(--cloud-fill, #fff);
  border-radius: 18px;
  box-shadow: var(--cloud-shadow, 0 4px 24px rgba(0,0,0,0.12)), 0 1px 3px rgba(0,0,0,0.06);
  pointer-events: auto;
  cursor: default;
}

/* place-left：气泡在宠物左侧，尾巴在气泡右边指向右（宠物方向） */
/* 注：top/right/left 现在由 inline style 动态计算（verticalOffset + horizontalOffset），CSS 仅保留非定位样式 */
.place-left {
  right: auto; /* 由 inline style 设置 */
}
/* place-right：气泡在宠物右侧，尾巴在气泡左边指向左（宠物方向） */
.place-right {
  left: auto; /* 由 inline style 设置 */
}

.weather-tail {
  position: absolute;
  bottom: 14px;
  width: 0; height: 0;
  border: 8px solid transparent;
}
/* 气泡在左侧 → 尾巴在右边，指向右 */
.place-left .weather-tail {
  right: -14px;
  border-left-color: var(--cloud-fill, #fff);
  border-right: 0;
}
/* 气泡在右侧 → 尾巴在左边，指向左 */
.place-right .weather-tail {
  left: -14px;
  border-right-color: var(--cloud-fill, #fff);
  border-left: 0;
}

/* ===== 天气图标容器 ===== */
.weather-icon {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
}

/* ===== 太阳（晴） ===== */
.sun-core {
  position: absolute;
  top: 50%; left: 50%;
  width: 18px; height: 18px;
  margin: -9px 0 0 -9px;
  border-radius: 50%;
  background: hsl(var(--primary));
  box-shadow: 0 0 8px 2px hsl(var(--primary) / 0.5);
  animation: sun-glow 2s ease-in-out infinite;
}
.sun-rays {
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  animation: sun-spin 12s linear infinite;
}
.sun-ray {
  position: absolute;
  top: -22px; left: -1px;
  width: 2px; height: 10px;
  border-radius: 1px;
  background: hsl(var(--primary) / 0.7);
  transform-origin: 1px 22px;
  transform: rotate(calc(var(--i) * 45deg));
}
@keyframes sun-spin {
  to { transform: rotate(360deg); }
}
@keyframes sun-glow {
  0%, 100% { box-shadow: 0 0 8px 2px hsl(var(--primary) / 0.5); }
  50%      { box-shadow: 0 0 16px 6px hsl(var(--primary) / 0.7); }
}

/* ===== 云朵 ===== */
.cloud-shape {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  animation: cloud-float 4s ease-in-out infinite;
}
.cloud-above { top: 35%; }
/* 雷暴乌云 — 深灰 */
.cloud-dark .cloud-part { background: hsl(var(--muted-foreground) / 0.7); }
/* 雪云 — 浅灰（比雨云浅） */
.cloud-light .cloud-part { background: hsl(var(--foreground) / 0.25); }
/* 少云薄云 — 极浅白（晴天基调） */
.cloud-partly .cloud-part { background: hsl(var(--foreground) / 0.12); }

/* 少云的小太阳（缩到正常的 70%） */
.sun-core--small {
  width: 13px; height: 13px;
  margin: -6px 0 0 -6px;
  top: 35%; left: 40%;
}

.cloud-part {
  position: absolute;
  background: hsl(var(--foreground) / 0.6);
  border-radius: 50%;
}
.cloud-main {
  width: 28px; height: 14px;
  border-radius: 14px;
  top: 6px; left: -14px;
}
.cloud-bump-l {
  width: 16px; height: 16px;
  top: -4px; left: -10px;
}
.cloud-bump-r {
  width: 20px; height: 18px;
  top: -8px; left: 4px;
}
@keyframes cloud-float {
  0%, 100% { transform: translate(-50%, -50%); }
  50%      { transform: translate(calc(-50% + 4px), calc(-50% - 2px)); }
}

/* ===== 雾线 ===== */
.fog-lines {
  position: absolute;
  bottom: 4px; left: 2px; right: 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fog-line {
  display: block;
  height: 2px;
  background: hsl(var(--muted-foreground) / 0.5);
  border-radius: 1px;
  animation: fog-drift 3s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.4s);
  width: calc(60% + var(--i) * 12%);
}
@keyframes fog-drift {
  0%, 100% { opacity: 0.3; transform: scaleX(0.6); }
  50%      { opacity: 0.7; transform: scaleX(1); }
}

/* ===== 雨滴 ===== */
.rain-drops {
  position: absolute;
  bottom: 2px; left: 6px; right: 6px;
  height: 20px;
}
.rain-drop {
  position: absolute;
  bottom: 0;
  left: calc(var(--i) * 20% - 8%);
  width: 2px;
  height: 6px;
  border-radius: 1px;
  background: hsl(var(--foreground) / 0.5);
  animation: rain-fall 0.8s linear infinite;
  animation-delay: calc(var(--i) * 0.15s);
}
@keyframes rain-fall {
  0%   { transform: translateY(0); opacity: 0; }
  30%  { opacity: 1; }
  100% { transform: translateY(18px); opacity: 0; }
}

/* ===== 雪花 ===== */
.snow-flakes {
  position: absolute;
  bottom: 2px; left: 4px; right: 4px;
  height: 22px;
}
.snow-flake {
  position: absolute;
  bottom: 0;
  left: calc(var(--i) * 20% - 6%);
  width: 5px; height: 5px;
  border-radius: 50%;
  background: hsl(var(--foreground) / 0.6);
  animation: snow-fall 2.2s linear infinite;
  animation-delay: calc(var(--i) * 0.4s);
}
@keyframes snow-fall {
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  20%  { opacity: 1; }
  50%  { transform: translateY(10px) translateX(4px); }
  100% { transform: translateY(22px) translateX(-3px); opacity: 0; }
}

/* ===== 闪电 ===== */
.lightning-glow {
  position: absolute;
  bottom: 2px; left: 50%;
  width: 28px; height: 28px;
  margin: 0 0 0 -14px;
  border-radius: 50%;
  background: hsl(var(--warning, 45 93% 47%) / 0.2);
  filter: blur(8px);
  animation: lightning-flash 2s ease-in-out infinite;
}

.lightning-bolt {
  position: absolute;
  bottom: 1px; left: 50%;
  width: 10px; height: 22px;
  margin-left: -5px;
  background: hsl(var(--warning, 45 93% 47%));
  border-radius: 2px;
  /* 锯齿闪电折线 */
  clip-path: polygon(
    55% 0%,
    95% 25%,
    70% 25%,
    100% 100%,
    10% 50%,
    35% 50%,
    5% 15%
  );
  filter: drop-shadow(0 0 4px hsl(var(--warning, 45 93% 47%) / 0.7));
  animation: lightning-flash 2s ease-in-out infinite;
}
@keyframes lightning-flash {
  0%, 88%, 100% { opacity: 0; }
  90%, 94%      { opacity: 1; }
}

/* ===== 天气信息文字 ===== */
.weather-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.weather-city {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.04em;
}

.weather-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.weather-desc {
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.weather-temp {
  font-size: 22px;
  font-weight: 800;
  color: hsl(var(--primary));
  letter-spacing: -0.02em;
}

.weather-tomorrow {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  opacity: 0.85;
}

.weather-care {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: hsl(var(--primary) / 0.85);
  font-style: italic;
}

.care-cursor {
  animation: caret-blink 0.7s step-end infinite;
}
@keyframes caret-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

/* ===== 进出场动画 ===== */
.weather-pop-enter-active {
  transition: opacity 0.25s ease-out, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.weather-pop-leave-active {
  transition: opacity 0.2s ease-in, transform 0.2s ease-in;
}
.weather-pop-enter-from,
.weather-pop-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

@media (prefers-reduced-motion: reduce) {
  .sun-core, .sun-rays { animation: none; }
  .cloud-shape { animation: none; }
  .rain-drop, .snow-flake, .fog-line, .lightning-bolt, .lightning-glow { animation: none; }
}
</style>
