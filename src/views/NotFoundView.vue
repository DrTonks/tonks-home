<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface Star {
  id: number
  x: number
  y: number
  size: number
  delay: number
  duration: number
}

const stars = ref<Star[]>([])
const show404 = ref(false)
const showStars = ref(false)
const countdown = ref(15)

let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>
let redirectTimer: ReturnType<typeof setTimeout>
let countdownTimer: ReturnType<typeof setInterval>

onMounted(() => {
  t1 = setTimeout(() => { show404.value = true }, 400)
  t2 = setTimeout(() => {
    showStars.value = true
    stars.value = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 3,
      duration: 2.5 + Math.random() * 5,
    }))
  }, 1200)

  countdownTimer = setInterval(() => {
    if (countdown.value > 0) countdown.value--
  }, 1000)

  redirectTimer = setTimeout(() => {
    window.location.href = '/'
  }, 15000)
})

onBeforeUnmount(() => {
  clearTimeout(t1)
  clearTimeout(t2)
  clearTimeout(redirectTimer)
  clearInterval(countdownTimer)
})
</script>

<template>
  <div class="fixed inset-0 bg-black flex flex-col items-center justify-center overflow-hidden select-none">
    <div class="glitch-container">
      <span v-if="show404" class="glitch-overlay glitch-red" aria-hidden="true">404</span>
      <span v-if="show404" class="glitch-overlay glitch-blue" aria-hidden="true">404</span>
      <span v-if="show404" class="glitch-main">404</span>
    </div>

    <p v-if="show404" class="mt-6 text-sm tracking-[0.3em] text-white/40 animate-fade-in-up">
      Not Found
    </p>

    <p href="/" v-if="show404" class="mt-4 text-xs tracking-[0.2em] text-white/20 animate-fade-in-up" style="animation-delay: 0.3s">
      回到首页 · {{ countdown }} 秒后自动返回
    </p>

    <a
      v-if="show404"
      class="mt-10 text-xs tracking-[0.2em] text-white/25 hover:text-white/60 transition-colors duration-500 animate-fade-in-up"
      style="animation-delay: 0.6s"
    >
      不许忘记我。
    </a>

    <template v-if="showStars">
      <span
        v-for="s in stars"
        :key="s.id"
        class="star absolute rounded-full bg-white"
        :style="{
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: `${s.size}px`,
          height: `${s.size}px`,
          animationDelay: `${s.delay}s`,
          animationDuration: `${s.duration}s`,
        }"
      />
    </template>
  </div>
</template>

<style scoped>
/* ===== 容器 ===== */
.glitch-container {
  position: relative;
  display: inline-block;
}

/* ===== 主体文字 ===== */
.glitch-main {
  font-family: 'JetBrains Mono', 'Geist Mono', monospace;
  font-size: clamp(100px, 22vw, 220px);
  font-weight: 900;
  letter-spacing: 0.05em;
  color: #fff;
  text-shadow: 0 0 40px rgba(255,255,255,0.3);
  position: relative;
  opacity: 0;
  animation: glitch-in 0.8s cubic-bezier(0.25, 0, 0.25, 1) forwards,
             glitch-shake 0.35s ease infinite;
  animation-delay: 0s, 0.8s;
}

/* ===== 色散层（绝对定位叠在主文字上） ===== */
.glitch-overlay {
  font-family: 'JetBrains Mono', 'Geist Mono', monospace;
  font-size: clamp(100px, 22vw, 220px);
  font-weight: 900;
  letter-spacing: 0.05em;
  position: absolute;
  top: 0;
  left: 0;
  white-space: nowrap;
  opacity: 0;
  animation: glitch-in 0.8s cubic-bezier(0.25, 0, 0.25, 1) forwards;
  pointer-events: none;
}

.glitch-red {
  color: #ff3333;
  clip-path: inset(0 0 70% 0);
  animation-name: glitch-in, glitch-clip-a;
  animation-duration: 0.8s, 0.28s;
  animation-delay: 0s, 0.9s;
  animation-fill-mode: forwards, none;
  animation-iteration-count: 1, infinite;
}

.glitch-blue {
  color: #3399ff;
  clip-path: inset(70% 0 0 0);
  animation-name: glitch-in, glitch-clip-b;
  animation-duration: 0.8s, 0.33s;
  animation-delay: 0s, 0.95s;
  animation-fill-mode: forwards, none;
  animation-iteration-count: 1, infinite;
}

/* ===== 入场 ===== */
@keyframes glitch-in {
  0%   { opacity: 0; transform: scale(1.3); filter: blur(12px); }
  50%  { opacity: 0.6; filter: blur(4px); }
  100% { opacity: 1; transform: scale(1); filter: blur(0); }
}

/* ===== 持续抖动 ===== */
@keyframes glitch-shake {
  0%, 100% { transform: translateX(0); }
  15%  { transform: translateX(-5px); }
  30%  { transform: translateX(7px); }
  45%  { transform: translateX(-3px); }
  60%  { transform: translateX(4px); }
  75%  { transform: translateX(-6px); }
  90%  { transform: translateX(2px); }
}

/* ===== 色散撕裂（不同周期产生伪随机重叠） ===== */
@keyframes glitch-clip-a {
  0%   { clip-path: inset(0 0 68% 0); transform: translate(0, 0); }
  20%  { clip-path: inset(15% 0 50% 0); transform: translate(-10px, 2px); }
  40%  { clip-path: inset(45% 0 25% 0); transform: translate(8px, -3px); }
  60%  { clip-path: inset(5% 0 55% 0); transform: translate(-4px, 1px); }
  80%  { clip-path: inset(35% 0 35% 0); transform: translate(6px, -2px); }
  100% { clip-path: inset(0 0 68% 0); transform: translate(0, 0); }
}

@keyframes glitch-clip-b {
  0%   { clip-path: inset(65% 0 0 0); transform: translate(0, 0); }
  25%  { clip-path: inset(45% 0 15% 0); transform: translate(8px, -1px); }
  50%  { clip-path: inset(25% 0 50% 0); transform: translate(-6px, 3px); }
  75%  { clip-path: inset(55% 0 5% 0); transform: translate(4px, -2px); }
  100% { clip-path: inset(65% 0 0 0); transform: translate(0, 0); }
}

/* ===== 副标题 ===== */
@keyframes fade-in-up {
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}

.animate-fade-in-up {
  animation: fade-in-up 1s ease-out forwards;
  opacity: 0;
}

/* ===== 星星（无 box-shadow 减少 GPU 开销） ===== */
.star {
  animation: star-fade 3s ease-in-out infinite alternate;
  opacity: 0;
}

@keyframes star-fade {
  0%   { opacity: 0; transform: scale(0.3); }
  30%  { opacity: 0.85; }
  70%  { opacity: 0.2; transform: scale(1.5); }
  100% { opacity: 0.8; transform: scale(1); }
}
</style>
