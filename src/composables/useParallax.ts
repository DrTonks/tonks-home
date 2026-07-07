import { ref, onMounted, onBeforeUnmount } from 'vue'

interface ParallaxLayer {
  el: HTMLElement | null
  strength: number // 旋转强度（度）
}

/**
 * 3D 视差 — document.mousemove 驱动
 * 不同层不同强度，鼠标移出弹性回弹
 */
export function useParallax(layers: () => ParallaxLayer[]) {
  const targetX = ref(0)
  const targetY = ref(0)
  const currentX = ref(0)
  const currentY = ref(0)
  let rafId: number | null = null
  let isListening = false

  function onMouseMove(e: MouseEvent) {
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    // 归一化到 [-1, 1]
    targetX.value = (e.clientX - cx) / cx
    targetY.value = (e.clientY - cy) / cy
  }

  function onMouseLeave() {
    targetX.value = 0
    targetY.value = 0
  }

  function tick() {
    // 弹性插值（lerp 0.08）
    currentX.value += (targetX.value - currentX.value) * 0.08
    currentY.value += (targetY.value - currentY.value) * 0.08

    for (const layer of layers()) {
      if (!layer.el) continue
      const rotX = currentY.value * layer.strength
      const rotY = -currentX.value * layer.strength
      layer.el.style.transform = `perspective(1200px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`
    }

    rafId = requestAnimationFrame(tick)
  }

  function start() {
    if (isListening) return
    isListening = true
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)
    rafId = requestAnimationFrame(tick)
  }

  function stop() {
    if (!isListening) return
    isListening = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseleave', onMouseLeave)
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  onMounted(() => {
    // 检测 prefers-reduced-motion，若启用则不启动
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // 检测移动端，移动端不启动 3D 视差
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return
    start()
  })

  onBeforeUnmount(stop)

  return { start, stop, currentX, currentY }
}
