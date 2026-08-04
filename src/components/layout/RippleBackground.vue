<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const SIM_MAX_WIDTH = 320
const SIM_MIN_WIDTH = 150
const FRAME_INTERVAL_MS = 1000 / 60
const WATER_STEP_MS = 1000 / 30
const RIPPLE_LIFETIME_MS = 4800
const RIPPLE_FADE_MS = 1800
const RAIN_MIN_MS = 3000
const RAIN_MAX_MS = 6000
const AMBIENT_MIN_MS = 5000
const AMBIENT_MAX_MS = 10000
const DAMPING = 0.9855

const layerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const effectsCanvasRef = ref<HTMLCanvasElement | null>(null)

interface RainDrop {
  x: number
  y: number
  targetY: number
  simX: number
  simY: number
  strength: number
  velocityX: number
  velocityY: number
  width: number
}

interface Plip {
  x: number
  y: number
  remaining: number
}

let context: CanvasRenderingContext2D | null = null
let effectsContext: CanvasRenderingContext2D | null = null
let output: ImageData | null = null
let current = new Float32Array(0)
let previous = new Float32Array(0)
let simWidth = 0
let simHeight = 0
let frameId: number | null = null
let rainTimer: ReturnType<typeof setTimeout> | null = null
let ambientTimer: ReturnType<typeof setTimeout> | null = null
const secondaryRainTimers = new Set<ReturnType<typeof setTimeout>>()
let resizeObserver: ResizeObserver | null = null
let lastFrameAt = 0
let lastImpulseAt = 0
let stepAccumulator = 0
let surfaceTime = 0
let reducedMotion = false
let layerWidth = 0
let layerHeight = 0
let effectsDpr = 1
const drops: RainDrop[] = []
const plips: Plip[] = []

function resetSurface() {
  const layer = layerRef.value
  const canvas = canvasRef.value
  const effectsCanvas = effectsCanvasRef.value
  if (!layer || !canvas || !effectsCanvas) return

  const { width, height } = layer.getBoundingClientRect()
  if (width < 2 || height < 2) return

  layerWidth = width
  layerHeight = height

  simWidth = Math.min(SIM_MAX_WIDTH, Math.max(SIM_MIN_WIDTH, Math.round(width / 4)))
  simHeight = Math.max(80, Math.round(simWidth * height / width))
  canvas.width = simWidth
  canvas.height = simHeight

  context = canvas.getContext('2d')
  effectsDpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
  effectsCanvas.width = Math.round(width * effectsDpr)
  effectsCanvas.height = Math.round(height * effectsDpr)
  effectsContext = effectsCanvas.getContext('2d')
  effectsContext?.setTransform(effectsDpr, 0, 0, effectsDpr, 0, 0)
  output = context?.createImageData(simWidth, simHeight) ?? null
  current = new Float32Array(simWidth * simHeight)
  previous = new Float32Array(simWidth * simHeight)
  stepAccumulator = 0
  surfaceTime = 0
  stopAnimation(true)
}

function poke(x: number, y: number, strength: number, radius: number) {
  const centerX = Math.round(x)
  const centerY = Math.round(y)
  const extent = Math.ceil(radius)
  const radiusSquared = radius * radius

  for (let offsetY = -extent; offsetY <= extent; offsetY++) {
    for (let offsetX = -extent; offsetX <= extent; offsetX++) {
      const px = centerX + offsetX
      const py = centerY + offsetY
      if (px < 1 || py < 1 || px >= simWidth - 1 || py >= simHeight - 1) continue

      const distanceSquared = offsetX * offsetX + offsetY * offsetY
      if (distanceSquared > radiusSquared) continue
      const falloff = 0.5 + 0.5 * Math.cos(Math.PI * Math.sqrt(distanceSquared / radiusSquared))
      current[py * simWidth + px] += strength * falloff
    }
  }
}

function beginImpulse() {
  if (!simWidth || !simHeight) return null
  const now = performance.now()
  if (lastImpulseAt && now - lastImpulseAt >= RIPPLE_LIFETIME_MS) clearWaterSurface()
  return now
}

function finishImpulse(now: number) {
  lastImpulseAt = now
  startAnimation()
}

function addImpulse(x: number, y: number, strength = 2, radius = 3) {
  const now = beginImpulse()
  if (now === null) return
  poke(x, y, strength, radius)
  finishImpulse(now)
}

function addRainImpact(x: number, y: number, strength: number) {
  const now = beginImpulse()
  if (now === null) return
  poke(x, y, strength * 1.15, 1.6)
  poke(x, y, -strength * 0.4, 3.2)
  finishImpulse(now)
}

function spawnRainDrop(strength: number) {
  if (!simWidth || !simHeight || !layerWidth || !layerHeight) return
  const point = randomPoint()
  const targetX = point.x / simWidth * layerWidth
  const targetY = point.y / simHeight * layerHeight
  const fall = layerHeight * randomBetween(0.34, 0.52)
  const duration = randomBetween(0.3, 0.42)
  const velocityX = randomBetween(-8, 14)

  drops.push({
    x: targetX - velocityX * duration,
    y: targetY - fall,
    targetY,
    simX: point.x,
    simY: point.y,
    strength,
    velocityX,
    velocityY: fall / duration,
    width: 1 + strength * 0.35,
  })
  startAnimation()
}

function updateRainEffects(deltaSeconds: number) {
  const ctx = effectsContext
  if (!ctx) return
  ctx.clearRect(0, 0, layerWidth, layerHeight)

  for (let index = drops.length - 1; index >= 0; index--) {
    const drop = drops[index]
    drop.x += drop.velocityX * deltaSeconds
    drop.y += drop.velocityY * deltaSeconds

    if (drop.y >= drop.targetY) {
      addRainImpact(drop.simX, drop.simY, drop.strength)
      plips.push({ x: drop.x, y: drop.targetY, remaining: 0.22 })
      drops.splice(index, 1)
      continue
    }

    const length = Math.min(26, drop.velocityY * 0.045)
    const tailX = drop.x - drop.velocityX * (length / drop.velocityY)
    const tailY = drop.y - length
    const gradient = ctx.createLinearGradient(tailX, tailY, drop.x, drop.y)
    gradient.addColorStop(0, 'rgba(214, 229, 248, 0)')
    gradient.addColorStop(0.7, 'rgba(206, 223, 246, 0.42)')
    gradient.addColorStop(1, 'rgba(232, 243, 255, 0.8)')
    ctx.strokeStyle = gradient
    ctx.lineWidth = drop.width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(tailX, tailY)
    ctx.lineTo(drop.x, drop.y)
    ctx.stroke()
  }

  for (let index = plips.length - 1; index >= 0; index--) {
    const plip = plips[index]
    plip.remaining -= deltaSeconds
    if (plip.remaining <= 0) {
      plips.splice(index, 1)
      continue
    }

    const alpha = plip.remaining / 0.22
    ctx.strokeStyle = `rgba(228, 241, 255, ${0.45 * alpha})`
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.arc(plip.x, plip.y, 1.2 + (1 - alpha) * 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = `rgba(236, 246, 255, ${0.55 * alpha * alpha})`
    ctx.beginPath()
    ctx.arc(plip.x, plip.y, 1.4 * alpha + 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function stepWater() {
  surfaceTime += WATER_STEP_MS / 1000
  for (let y = 1; y < simHeight - 1; y++) {
    let index = y * simWidth + 1
    for (let x = 1; x < simWidth - 1; x++, index++) {
      previous[index] = (
        (current[index - 1] + current[index + 1] + current[index - simWidth] + current[index + simWidth]) * 0.5
        - previous[index]
      ) * DAMPING
        + 0.0024 * Math.sin(surfaceTime * 0.7 + x * 0.05 + y * 0.021)
        + 0.0019 * Math.sin(surfaceTime * 0.43 - x * 0.023 + y * 0.041)
    }
  }

  const swap = current
  current = previous
  previous = swap
}

function renderWater(opacity = 1) {
  if (!context || !output) return

  const pixels = output.data
  for (let y = 0; y < simHeight; y++) {
    const up = y > 0 ? y - 1 : y
    const down = y < simHeight - 1 ? y + 1 : y
    for (let x = 0; x < simWidth; x++) {
      const index = y * simWidth + x
      const gradientY = current[up * simWidth + x] - current[down * simWidth + x]
      const pixel = index * 4
      const alpha = Math.min(118, Math.abs(gradientY) * 175)

      if (gradientY >= 0) {
        pixels[pixel] = 226
        pixels[pixel + 1] = 244
        pixels[pixel + 2] = 255
      } else {
        pixels[pixel] = 43
        pixels[pixel + 1] = 106
        pixels[pixel + 2] = 140
      }
      pixels[pixel + 3] = alpha * opacity
    }
  }

  context.putImageData(output, 0, 0)
}

function animate(timestamp: number) {
  if (document.hidden) {
    stopAnimation(true)
    return
  }

  frameId = requestAnimationFrame(animate)
  if (timestamp - lastFrameAt < FRAME_INTERVAL_MS) return
  const delta = lastFrameAt ? Math.min(50, timestamp - lastFrameAt) : WATER_STEP_MS
  lastFrameAt = timestamp
  updateRainEffects(delta / 1000)

  let elapsed = lastImpulseAt ? timestamp - lastImpulseAt : Number.POSITIVE_INFINITY
  if (lastImpulseAt && elapsed < RIPPLE_LIFETIME_MS + RIPPLE_FADE_MS) {
    stepAccumulator += delta
    let steps = 0
    while (stepAccumulator >= WATER_STEP_MS && steps < 2) {
      stepWater()
      stepAccumulator -= WATER_STEP_MS
      steps++
    }
    elapsed = timestamp - lastImpulseAt
    const opacity = elapsed <= RIPPLE_LIFETIME_MS
      ? 1
      : 1 - (elapsed - RIPPLE_LIFETIME_MS) / RIPPLE_FADE_MS
    renderWater(opacity)
  } else if (lastImpulseAt) {
    current.fill(0)
    previous.fill(0)
    output?.data.fill(0)
    context?.clearRect(0, 0, simWidth, simHeight)
    lastImpulseAt = 0
  }

  if (!lastImpulseAt && drops.length === 0 && plips.length === 0) stopAnimation(false)
}

function startAnimation() {
  if (reducedMotion || document.hidden || frameId !== null) return
  lastFrameAt = 0
  stepAccumulator = 0
  frameId = requestAnimationFrame(animate)
}

function clearWaterSurface() {
  current.fill(0)
  previous.fill(0)
  output?.data.fill(0)
  context?.clearRect(0, 0, simWidth, simHeight)
  lastImpulseAt = 0
}

function stopAnimation(clearCanvas: boolean) {
  if (frameId !== null) {
    cancelAnimationFrame(frameId)
    frameId = null
  }
  if (clearCanvas) {
    clearWaterSurface()
    effectsContext?.clearRect(0, 0, layerWidth, layerHeight)
    drops.length = 0
    plips.length = 0
  }
}

function triggerCenter() {
  if (reducedMotion) return
  addImpulse(simWidth / 2, simHeight / 2)
}

defineExpose({ triggerCenter })

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randomPoint() {
  return {
    x: randomBetween(2, Math.max(2, simWidth - 2)),
    y: randomBetween(2, Math.max(2, simHeight - 2)),
  }
}

function triggerRandomRain(strength = randomBetween(0.8, 1.5)) {
  spawnRainDrop(strength)
}

function scheduleRainRipple() {
  if (rainTimer) clearTimeout(rainTimer)
  rainTimer = null
  if (reducedMotion || document.hidden) return

  rainTimer = setTimeout(() => {
    rainTimer = null
    triggerRandomRain()
    if (Math.random() < 0.18) {
      const timer = setTimeout(() => {
        secondaryRainTimers.delete(timer)
        if (!document.hidden) triggerRandomRain(randomBetween(0.5, 0.9))
      }, randomBetween(120, 320))
      secondaryRainTimers.add(timer)
    }
    scheduleRainRipple()
  }, randomBetween(RAIN_MIN_MS, RAIN_MAX_MS))
}

function scheduleAmbientRipple() {
  if (ambientTimer) clearTimeout(ambientTimer)
  ambientTimer = null
  if (reducedMotion || document.hidden) return

  ambientTimer = setTimeout(() => {
    ambientTimer = null
    const point = randomPoint()
    addImpulse(point.x, point.y, randomBetween(0.25, 0.55), 3)
    scheduleAmbientRipple()
  }, randomBetween(AMBIENT_MIN_MS, AMBIENT_MAX_MS))
}

function clearRippleTimers() {
  if (rainTimer) clearTimeout(rainTimer)
  if (ambientTimer) clearTimeout(ambientTimer)
  rainTimer = null
  ambientTimer = null
  for (const timer of secondaryRainTimers) clearTimeout(timer)
  secondaryRainTimers.clear()
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopAnimation(true)
    clearRippleTimers()
    return
  }
  scheduleRainRipple()
  scheduleAmbientRipple()
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  resetSurface()
  resizeObserver = new ResizeObserver(resetSurface)
  if (layerRef.value) resizeObserver.observe(layerRef.value)

  document.addEventListener('visibilitychange', handleVisibilityChange)
  scheduleRainRipple()
  scheduleAmbientRipple()
})

onBeforeUnmount(() => {
  stopAnimation(true)
  clearRippleTimers()
  resizeObserver?.disconnect()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div ref="layerRef" class="ripple-background absolute inset-0 pointer-events-none" aria-hidden="true">
    <canvas ref="canvasRef" class="ripple-surface absolute inset-0 h-full w-full" />
    <canvas ref="effectsCanvasRef" class="rain-effects absolute inset-0 h-full w-full" />
  </div>
</template>

<style scoped>
.ripple-background {
  z-index: 2;
  opacity: 0.72;
  overflow: hidden;
}

.ripple-surface {
  image-rendering: auto;
}
</style>
