<script setup lang="ts">
import { ref, onMounted } from 'vue'

const ROWS = 16
const COLS = 18
const HEX_W = 86.5
const HEX_H = 74.5
const TOTAL = ROWS * COLS

const containerRef = ref<HTMLDivElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const hexes = ref<SVGPolygonElement[]>([])

const emit = defineEmits<{ done: [] }>()

// 预加载关键资源
const isMobile = window.matchMedia('(max-width: 768px)').matches

const PRELOAD_IMAGES = [
  '/assets/avatar.jpg',
  ...(isMobile
    ? ['/assets/ph-bg.jpg']
    : [
        '/assets/pet/idle.png',
        '/assets/pet/happy.png',
        '/assets/pet/angry.png',
        '/assets/pet/halfClosed.png',
        '/assets/pet/almostClosed.png',
        '/assets/pet/blink.png',
      ]
  ),
]

let imgLoadedCount = 0
const imagesPreloaded = ref(false)

function preloadImages(): Promise<void> {
  return new Promise((resolve) => {
    if (!PRELOAD_IMAGES.length) { resolve(); return }
    for (const src of PRELOAD_IMAGES) {
      const img = new Image()
      img.onload = img.onerror = () => {
        imgLoadedCount++
        if (imgLoadedCount >= PRELOAD_IMAGES.length) {
          imagesPreloaded.value = true
          resolve()
        }
      }
      img.src = src
    }
  })
}

/**
 * 预加载首页 JS chunk（级联下载 echarts-vendor + HomeView）
 * 在加载动画期间并行拉取，动画结束后首页即渲染，无需再等网络。
 * 失败不阻塞：router 懒加载会重试。
 */
function preloadHomeChunk(): Promise<void> {
  return import('@/views/HomeView.vue')
    .then(() => { console.log('[Loading] JS chunks preloaded') })
    .catch((err) => { console.warn('[Loading] JS preload failed, will retry on navigation:', err) })
}

// WAAPI 动画
async function playReveal() {
  const els = hexes.value
  if (!els.length) return

  // Phase 1: 描边浮现（随机起点，交错延迟）
  const revealAnims = els.map((el, i) => {
    const from = Math.random() > 0.5 ? -100 : 100
    return el.animate(
      [
        { strokeDashoffset: from, strokeOpacity: 0, offset: 0 },
        { strokeDashoffset: 0, strokeOpacity: 1, offset: 1 },
      ],
      {
        duration: 400,
        delay: Math.random() * 200 + i * 1.5,
        easing: 'cubic-bezier(0.25, 0, 0.25, 1)',
        fill: 'forwards',
      },
    )
  })
  await Promise.all(revealAnims.map((a) => a.finished))
}

async function playCollapse() {
  const els = hexes.value
  if (!els.length) return

  // Phase 2: 从中心向外淡出
  const centerIdx = Math.floor(TOTAL / 2)
  const sorted = els.map((el, i) => ({ el, dist: Math.abs(i - centerIdx) + Math.abs((i % COLS) - Math.floor(COLS / 2)) })).sort((a, b) => a.dist - b.dist)

  const collapseAnims = sorted.map(({ el }, i) =>
    el.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 1 },
      ],
      {
        duration: 350,
        delay: i * 2,
        easing: 'cubic-bezier(0.5, 0, 0.75, 0)',
        fill: 'forwards',
      },
    ),
  )
  await Promise.all(collapseAnims.map((a) => a.finished))
}


// 整体淡出
async function fadeContainer() {
  if (!containerRef.value) return
  await containerRef.value.animate(
    [
      { opacity: 1 },
      { opacity: 0 },
    ],
    { duration: 350, easing: 'ease-out', fill: 'forwards' },
  ).finished
}

onMounted(async () => {
  // 图片 + JS chunk 并行预加载
  const preloadPromise = preloadImages()
  const jsPreloadPromise = preloadHomeChunk()

  // 等 SVG 渲染完成再获取 hex 元素
  await new Promise((r) => requestAnimationFrame(r))
  await new Promise((r) => requestAnimationFrame(r))

  // 用 querySelectorAll 代替 :ref（v-for 内 ref 函数可能不触发）
  const els = Array.from(svgRef.value?.querySelectorAll<SVGPolygonElement>('.ld-hex') || [])
  hexes.value = els
  console.log('[Loading] hexes found:', els.length)

  // ===== 环形参数（reveal 之前就着色，确保一开始就可见） =====
  const ring = [115, 116, 117, 135, 154, 171, 189, 188, 187, 168, 150, 132]
  const RING_LEN = ring.length
  const COLORS = [
    'rgba(175,210,238,0.45)',   // 0 略深于默认格，做区分
    'rgba(160,210,240,0.55)',   // 1
    'rgba(110,185,230,0.78)',   // 2
    'hsl(207,70%,65%)',         // 3 最亮
  ]
  const intensities = new Array(RING_LEN).fill(0)
  let cursor = 0

  // 设过渡，等首次绘制后再渐变着色（让默认色先出现在屏幕上）
  ring.forEach(i => {
    const el = hexes.value[i]
    if (el) el.style.transition = `fill ${500}ms ease-out`
  })
  setTimeout(() => {
    ring.forEach(i => {
      const el = hexes.value[i]
      if (el) el.style.fill = COLORS[0]
    })
  }, 500)

  await playReveal()

  function applyColor(idx: number, level: number) {
    const el = hexes.value[ring[idx]]
    if (el) el.style.fill = COLORS[level]
  }

  function spinnerTick() {
    // 当前格设为最高亮度
    intensities[cursor] = 3
    applyColor(cursor, 3)

    // 所有其他格衰减一级
    for (let i = 0; i < RING_LEN; i++) {
      if (i === cursor) continue
      const prev = intensities[i]
      if (prev > 0) {
        intensities[i] = prev - 1
        applyColor(i, prev - 1)
      }
    }

    cursor = (cursor + 1) % RING_LEN
  }

  const spinnerTimer = setInterval(spinnerTick, 200)
  spinnerTick()

  await preloadPromise
  await jsPreloadPromise

  // 加载完成：切换为绿色（代表通过/完成）
  clearInterval(spinnerTimer)
  ring.forEach(i => {
    if (hexes.value[i]) hexes.value[i].style.fill = 'hsl(145, 50%, 55%)'
  })

  await playCollapse()
  await fadeContainer()

  emit('done')
})

</script>

<template>
  <div ref="containerRef" class="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden" style="background: hsl(var(--background))">
    <div class="absolute inset-0 pointer-events-none"
      style="background: radial-gradient(ellipse at center, hsl(var(--color-sky) / 0.2) 0%, transparent 55%);"
    />

    <svg
      ref="svgRef"
      class="w-full h-full"
      viewBox="0 0 1400 1100"
      preserveAspectRatio="xMidYMid slice"
    >
      <g v-for="l in ROWS" :key="l">
        <polygon
          v-for="r in COLS"
          :key="`${l}-${r}`"
          class="ld-hex"
          points="0,-50 43.3,-25 43.3,25 0,50 -43.3,25 -43.3,-25"
          fill="rgba(200,225,245,0.25)"
          stroke="hsl(207 70% 65%)"
          stroke-width="0.8"
          :transform="`translate(${l % 2 ? HEX_W * (r - 1) : HEX_W * (r - 1) + HEX_W / 2}, ${HEX_H * (l - 1)})`"
          style="stroke-dasharray: 100; stroke-dashoffset: 100; stroke-opacity: 0;"
        />
      </g>
    </svg>
  </div>
</template>
