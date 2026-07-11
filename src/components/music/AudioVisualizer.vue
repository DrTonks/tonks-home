<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'
import { useMusicStore } from '@/stores/music'
import { useThemeStore } from '@/stores/theme'

const props = withDefaults(defineProps<{
  size?: number
  innerRadius?: number
  barMaxHeight?: number
  barCount?: number
  barWidth?: number
}>(), {
  size: 360,
  innerRadius: 72,
  barMaxHeight: 50,
  barCount: 80,
  barWidth: 3,
})

const store = useMusicStore()
const theme = useThemeStore()
const { getFrequencyData } = useAudioAnalyzer()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId = 0
let smoothedData: Float32Array | null = null

/**
 * 降采样 + 高频 EQ 补偿（1.0x → 2.0x）
 */
function downsampleWithEQ(raw: Uint8Array, count: number): Float32Array {
  const out = new Float32Array(count)
  const step = raw.length / count
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * step)
    const end = Math.floor((i + 1) * step)
    let sum = 0
    for (let j = start; j < end; j++) sum += raw[j]
    const avg = (sum / (end - start)) / 255
    out[i] = Math.min(1, avg * (1.0 + (i / (count - 1)) * 1.2))
  }
  return out
}

/**
 * 相邻带动：每根音柱将其 15% 能量传递给左右邻居（仅抬升、不拉低）。
 * 始终从原始 smoothed 取值，避免递归放大。
 */
function neighborBoost(data: Float32Array): Float32Array {
  const count = data.length
  const boosted = new Float32Array(count)
  for (let i = 0; i < count; i++) boosted[i] = data[i]

  const influence = 0.15
  for (let i = 0; i < count; i++) {
    const v = data[i]
    if (v < 0.04) continue
    const left = (i - 1 + count) % count
    const right = (i + 1) % count
    boosted[left] = Math.max(boosted[left], data[left] + v * influence)
    boosted[right] = Math.max(boosted[right], data[right] + v * influence)
  }
  return boosted
}

/**
 * 音柱颜色：高度 0→1 时色相从深蓝(230)→亮青(180)，饱和度/明度同步拉升
 */
function barColor(value: number): string {
  const v = Math.min(1, Math.max(0, value))
  if (theme.isDark) {
    // 暗色：低音纯白 → 高音淡橙/金（深空背景上更醒目）
    const h = 42                  // 暖橙金色相
    const s = v * 90              // 0(纯白) → 90%
    const l = 100 - v * 26        // 100%(白) → 74%
    const a = 0.5 + v * 0.5       // 50% → 100%
    return `hsla(${h}, ${s}%, ${l}%, ${a})`
  }
  const h = 230 - v * 50          // 230(深蓝) → 180(亮青)
  const s = 35 + v * 50           // 35% → 85%
  const l = 22 + v * 45           // 22% → 67%
  const a = 0.4 + v * 0.55        // 40% → 95% 透明度
  return `hsla(${h}, ${s}%, ${l}%, ${a})`
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(window.devicePixelRatio, 2)
  const size = props.size
  canvas.width = size * dpr
  canvas.height = size * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const cx = size / 2
  const cy = size / 2
  const count = props.barCount
  const raw = getFrequencyData()
  const samples = downsampleWithEQ(raw, count)

  if (!smoothedData || smoothedData.length !== count) {
    smoothedData = new Float32Array(count)
  }

  const smoothing = store.isPlaying ? 0.4 : 0.06
  let maxVal = 0
  for (let i = 0; i < count; i++) {
    smoothedData[i] += (samples[i] - smoothedData[i]) * smoothing
    if (smoothedData[i] > maxVal) maxVal = smoothedData[i]
  }

  ctx.clearRect(0, 0, size, size)

  if (!store.isPlaying && maxVal < 0.02) {
    animId = 0
    return
  }

  const data = neighborBoost(smoothedData)
  const innerR = props.innerRadius
  const maxH = props.barMaxHeight
  const barW = props.barWidth
  const angleStep = (2 * Math.PI) / count

  // ── 音柱 ──
  for (let i = 0; i < count; i++) {
    const value = Math.max(0.005, data[i])
    const angle = i * angleStep - Math.PI / 2
    const h = value * maxH

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const x1 = innerR * cos + cx
    const y1 = innerR * sin + cy
    const x2 = (innerR + h) * cos + cx
    const y2 = (innerR + h) * sin + cy

    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = barColor(value)
    ctx.lineWidth = barW
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // ── 内圈基线 ──
  ctx.beginPath()
  ctx.arc(cx, cy, innerR, 0, 2 * Math.PI)
  ctx.strokeStyle = theme.isDark ? 'rgba(255, 255, 255, 0.14)' : 'hsla(207, 40%, 65%, 0.15)'
  ctx.lineWidth = 0.8
  ctx.stroke()

  animId = requestAnimationFrame(draw)
}

function startLoop() { if (animId) return; animId = requestAnimationFrame(draw) }
function stopLoop() { if (animId) { cancelAnimationFrame(animId); animId = 0 } }

watch(() => store.isPlaying, (playing) => {
  if (playing) startLoop()
  else { if (!animId) animId = requestAnimationFrame(draw) }
})

onMounted(() => { startLoop() })
onBeforeUnmount(() => { stopLoop() })
</script>

<template>
  <canvas
    ref="canvasRef"
    :style="{ width: `${size}px`, height: `${size}px` }"
    class="pointer-events-none"
  />
</template>
