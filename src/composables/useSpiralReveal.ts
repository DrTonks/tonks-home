import { ref, onBeforeUnmount, type Ref } from 'vue'

/**
 * 螺旋展开动画 — 使用 Web Animations API (WAAPI)
 * 浏览器原生，零依赖，GPU 加速
 *
 * 每个区域沿阿基米德螺线 r = targetDist × t 从中心向外
 * 30 个关键帧描出真正的螺旋轨迹
 * 头像逆时针自转一周作为载体
 */

export interface SpiralTarget {
  el: HTMLElement | null
  x: number
  y: number
  startAngle: number
  turns: number
}

export function useSpiralReveal(
  avatarRef: Ref<HTMLElement | null>,
  targets: Ref<SpiralTarget[]>,
) {
  const isExpanded = ref(false)
  const isAnimating = ref(false)
  let animations: Animation[] = []
  let stateTimer: ReturnType<typeof setTimeout> | null = null

  function cancelAll() {
    animations.forEach((a) => {
      try {
        a.cancel()
      } catch {
        // ignore
      }
    })
    animations = []
    if (stateTimer) {
      clearTimeout(stateTimer)
      stateTimer = null
    }
  }

  function setInitial() {
    const valid = targets.value.filter((t) => t.el)
    valid.forEach((t) => {
      const el = t.el as HTMLElement
      el.style.opacity = '0'
      el.style.transform = 'translate(-50%, -50%) translate(0px, 0px) scale(0)'
    })
  }

  /** 生成阿基米德螺线关键帧 */
  function generateSpiralKeyframes(target: SpiralTarget): Keyframe[] {
    const { x: tx, y: ty, startAngle, turns } = target
    const targetDist = Math.hypot(tx, ty)
    const targetAngle = Math.atan2(ty, tx)
    const endAngle = targetAngle - turns * Math.PI * 2
    const steps = 30
    const keyframes: Keyframe[] = []

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const angle = startAngle + (endAngle - startAngle) * t
      const r = targetDist * t
      const x = r * Math.cos(angle)
      const y = r * Math.sin(angle)
      // 缩放：前 30% 慢慢从 0 到 0.4，后 70% 从 0.4 到 1
      const scale = t < 0.3 ? (t / 0.3) * 0.4 : 0.4 + ((t - 0.3) / 0.7) * 0.6
      // 透明度：前 40% 从 0 到 1
      const opacity = Math.min(1, t * 2.5)
      keyframes.push({
        transform: `translate(-50%, -50%) translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${scale.toFixed(3)})`,
        opacity: opacity.toFixed(3),
        offset: t,
      })
    }
    return keyframes
  }

  function expand() {
    if (isAnimating.value || isExpanded.value) return
    const valid = targets.value
      .filter((t) => t.el)
      .map((t) => ({ ...t, el: t.el as HTMLElement }))
    if (!avatarRef.value || !valid.length) return
    isAnimating.value = true

    cancelAll()
    setInitial()

    const STAGGER = 180
    const COMPONENT_DURATION = 900
    const AVATAR_DURATION = 1400

    // 头像逆时针自转一周
    const avatarAnim = avatarRef.value.animate(
      [
        { transform: 'rotate(0deg)', offset: 0 },
        { transform: 'rotate(-360deg)', offset: 1 },
      ],
      {
        duration: AVATAR_DURATION,
        easing: 'cubic-bezier(0.37, 0, 0.63, 1)',
        fill: 'forwards',
      },
    )
    animations.push(avatarAnim)

    // 每个区域沿螺旋路径出场
    valid.forEach((target, idx) => {
      const keyframes = generateSpiralKeyframes(target)
      const anim = target.el.animate(keyframes, {
        duration: COMPONENT_DURATION,
        delay: idx * STAGGER,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        fill: 'forwards',
      })
      animations.push(anim)
    })

    // 总时长 = 头像时长（最长）+ 最后一个区域的 stagger
    const totalTime = Math.max(
      AVATAR_DURATION,
      COMPONENT_DURATION + (valid.length - 1) * STAGGER,
    )
    stateTimer = setTimeout(() => {
      isAnimating.value = false
      isExpanded.value = true
      stateTimer = null
    }, totalTime + 100)
  }

  function collapse() {
    if (isAnimating.value || !isExpanded.value) return
    const valid = targets.value
      .filter((t) => t.el)
      .map((t) => ({ ...t, el: t.el as HTMLElement }))
    if (!avatarRef.value || !valid.length) return
    isAnimating.value = true

    cancelAll()

    const COLLAPSE_DURATION = 700
    const STAGGER_REVERSE = 60

    // 头像反向旋转
    const avatarAnim = avatarRef.value.animate(
      [
        { transform: 'rotate(-360deg)', offset: 0 },
        { transform: 'rotate(0deg)', offset: 1 },
      ],
      {
        duration: COLLAPSE_DURATION,
        easing: 'cubic-bezier(0.37, 0, 0.63, 1)',
        fill: 'forwards',
      },
    )
    animations.push(avatarAnim)

    // 区域反向收起（从目标位置回到中心）
    valid.slice().reverse().forEach((target, idx) => {
      const anim = target.el.animate(
        [
          {
            transform: `translate(-50%, -50%) translate(${target.x}px, ${target.y}px) scale(1)`,
            opacity: 1,
            offset: 0,
          },
          {
            transform: 'translate(-50%, -50%) translate(0px, 0px) scale(0)',
            opacity: 0,
            offset: 1,
          },
        ],
        {
          duration: COLLAPSE_DURATION * 0.7,
          delay: idx * STAGGER_REVERSE,
          easing: 'cubic-bezier(0.4, 0, 1, 1)',
          fill: 'forwards',
        },
      )
      animations.push(anim)
    })

    const totalTime = COLLAPSE_DURATION + (valid.length - 1) * STAGGER_REVERSE
    stateTimer = setTimeout(() => {
      isAnimating.value = false
      isExpanded.value = false
      stateTimer = null
    }, totalTime + 100)
  }

  function toggle() {
    if (isExpanded.value) collapse()
    else expand()
  }

  onBeforeUnmount(() => {
    cancelAll()
  })

  return { isExpanded, isAnimating, expand, collapse, toggle, setInitial }
}
