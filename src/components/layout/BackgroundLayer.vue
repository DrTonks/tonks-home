<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  baseAlpha: number
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let particles: Particle[] = []
let rafId: number | null = null
let mouseX = -9999
let mouseY = -9999
let width = 0
let height = 0
let dpr = 1

const colors = [
  'hsl(207 65% 55%)',   // 深天蓝
  'hsl(207 60% 82%)',   // 浅天蓝
  'hsl(155 30% 55%)',   // 鼠尾草绿
  'hsl(155 28% 75%)',   // 浅薄荷
  'hsl(40 55% 55%)',    // 琥珀
  'hsl(207 70% 65%)',   // 亮天蓝
  'hsl(270 50% 68%)',   // 紫罗兰
]

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  width = window.innerWidth
  height = window.innerHeight
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
  }
}

function spawn(centerBiased = false) {
  const count = width < 768 ? 70 : 150
  particles = []
  const cx = width / 2
  const cy = height / 2
  for (let i = 0; i < count; i++) {
    let x: number, y: number
    if (centerBiased) {
      // 向中心聚拢：径向距离用幂函数偏向 0，粒子在内圈更多
      const maxR = Math.hypot(cx, cy)
      const r = maxR * Math.pow(Math.random(), 2.0)
      const angle = Math.random() * Math.PI * 2
      x = cx + r * Math.cos(angle)
      y = cy + r * Math.sin(angle)
    } else {
      x = Math.random() * width
      y = Math.random() * height
    }
    const baseAlpha = Math.random() * 0.4 + 0.25
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      size: Math.random() * 2.4 + 0.8,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: baseAlpha,
      baseAlpha,
    })
  }
}

function scatter() {
  // 展开时粒子向外散开（每个粒子随机延迟 0~600ms）
  const cx = width / 2
  const cy = height / 2
  particles.forEach((p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const dist = Math.hypot(dx, dy) || 1
    const force = 3 + Math.random() * 5
    setTimeout(() => {
      p.vx += (dx / dist) * force * 0.6
      p.vy += (dy / dist) * force * 0.6
    }, Math.random() * 600)
  })
}

function loop() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  for (const p of particles) {
    const dx = p.x - mouseX
    const dy = p.y - mouseY
    const distSq = dx * dx + dy * dy
    if (distSq < 22500) {
      const dist = Math.sqrt(distSq) || 1
      const force = (1 - dist / 150) * 0.6
      p.vx += (dx / dist) * force
      p.vy += (dy / dist) * force
      p.alpha = Math.min(1, p.baseAlpha + (1 - dist / 150) * 0.5)
    } else {
      p.alpha += (p.baseAlpha - p.alpha) * 0.05
    }
    p.vx *= 0.96
    p.vy *= 0.96
    p.vx += (Math.random() - 0.5) * 0.01
    p.vy += (Math.random() - 0.5) * 0.01
    p.x += p.vx
    p.y += p.vy
    if (p.x < -10) p.x = width + 10
    if (p.x > width + 10) p.x = -10
    if (p.y < -10) p.y = height + 10
    if (p.y > height + 10) p.y = -10
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = p.alpha
    ctx.fill()
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = p.alpha * 0.15
    ctx.fill()
  }
  ctx.globalAlpha = 1
  rafId = requestAnimationFrame(loop)
}

function onMouseMove(e: MouseEvent) { mouseX = e.clientX; mouseY = e.clientY }
function onMouseLeave() { mouseX = -9999; mouseY = -9999 }
function onResize() { resize(); spawn(true) }

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  if (!ctx) return
  resize()
  spawn(true)
  rafId = requestAnimationFrame(loop)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseleave', onMouseLeave)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseleave', onMouseLeave)
  window.removeEventListener('resize', onResize)
})

defineExpose({ scatter })
</script>

<template>
  <div class="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
    <!-- 基础渐变：蓝绿底，白色占比少 -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/8 to-secondary/22"
    />

    <!-- 8 个大色块光晕（蓝绿为主 + 少量琥珀） -->
    <div class="absolute top-[5%] left-[6%] w-[38rem] h-[38rem] rounded-full bg-primary/32 blur-[110px] animate-float-soft" style="animation-duration: 8s" />
    <div class="absolute top-[8%] right-[6%] w-[34rem] h-[34rem] rounded-full bg-secondary/30 blur-[110px] animate-float-soft" style="animation-delay: -3s; animation-duration: 10s" />
    <div class="absolute bottom-[5%] left-[6%] w-[36rem] h-[36rem] rounded-full bg-secondary/28 blur-[110px] animate-float-soft" style="animation-delay: -1.5s; animation-duration: 12s" />
    <div class="absolute bottom-[6%] right-[5%] w-[38rem] h-[38rem] rounded-full bg-primary/30 blur-[110px] animate-float-soft" style="animation-delay: -4s; animation-duration: 9s" />
    <div class="absolute top-[35%] left-[40%] w-[30rem] h-[30rem] rounded-full bg-primary/20 blur-[100px] animate-float-soft" style="animation-delay: -2s; animation-duration: 11s" />
    <div class="absolute top-[40%] right-[38%] w-[28rem] h-[28rem] rounded-full bg-secondary/22 blur-[100px] animate-float-soft" style="animation-delay: -5s; animation-duration: 13s" />
    <div class="absolute top-[20%] left-[45%] w-[22rem] h-[22rem] rounded-full bg-brand-amber/15 blur-[90px] animate-float-soft" style="animation-delay: -6s; animation-duration: 14s" />
    <div class="absolute bottom-[20%] left-[45%] w-[20rem] h-[20rem] rounded-full bg-brand-mint-soft/20 blur-[80px] animate-float-soft" style="animation-delay: -7s; animation-duration: 15s" />

    <!-- 网格（蓝调） -->
    <div
      class="absolute inset-0 opacity-45"
      style="
        background-image:
          linear-gradient(hsl(var(--color-sky-soft) / 0.30) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--color-sky-soft) / 0.30) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: radial-gradient(ellipse at center, black 28%, transparent 80%);
        -webkit-mask-image: radial-gradient(ellipse at center, black 28%, transparent 80%);
      "
    />
    <canvas ref="canvasRef" class="absolute inset-0" style="opacity: 0.75" />
  </div>
</template>
