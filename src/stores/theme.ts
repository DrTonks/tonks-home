import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'
const mql = window.matchMedia('(prefers-color-scheme: dark)')
const ART_FADE_HOLD_CLASS = 'theme-art-fade-hold'
const ART_FADE_ENTER_CLASS = 'theme-art-fade-enter'

let artFadeFrame1: number | null = null
let artFadeFrame2: number | null = null
let artFadeGeneration = 0

function cancelArtFadeFrames() {
  if (artFadeFrame1 !== null) cancelAnimationFrame(artFadeFrame1)
  if (artFadeFrame2 !== null) cancelAnimationFrame(artFadeFrame2)
  artFadeFrame1 = null
  artFadeFrame2 = null
}

function resetArtFadeClasses(el: HTMLElement) {
  cancelArtFadeFrames()
  el.classList.remove(ART_FADE_HOLD_CLASS, ART_FADE_ENTER_CLASS)
}

function releaseArtFade(el: HTMLElement, wasHeld: boolean) {
  cancelArtFadeFrames()
  if (wasHeld) {
    el.classList.remove(ART_FADE_HOLD_CLASS)
    el.classList.add(ART_FADE_ENTER_CLASS)
  }
  artFadeFrame1 = requestAnimationFrame(() => {
    artFadeFrame2 = requestAnimationFrame(() => {
      el.classList.remove(ART_FADE_ENTER_CLASS)
      artFadeFrame1 = null
      artFadeFrame2 = null
    })
  })
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')
  const systemDark = ref(mql.matches)

  const isDark = computed(
    () => mode.value === 'dark' || (mode.value === 'system' && systemDark.value),
  )

  function applyClass() {
    document.documentElement.classList.toggle('dark', isDark.value)
    // 同步移动端浏览器 UI 颜色（地址栏/状态栏），避免与深色页面割裂
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark.value ? '#0a1120' : '#F5F0F2')
  }

  function setMode(m: ThemeMode) {
    mode.value = m
    localStorage.setItem(STORAGE_KEY, m)
    applyClass()
  }

  /**
   * 在 light / dark 之间显式切换（脱离 system 跟随）。
   * 传入点击坐标时用 View Transitions 做圆形扩散过渡（从点击点贝塞尔扩大到全屏）；
   * 圆心/半径通过 CSS 变量 --vt-x/--vt-y/--vt-r 传给 index.css 的 @keyframes
   * （比 WAAPI 的 pseudoElement animate 兼容性更好）。
   * 浏览器不支持或 reduced-motion 时降级为瞬切。
   */
  function toggle(x?: number, y?: number, fadeCarouselArt = false) {
    const next: ThemeMode = isDark.value ? 'light' : 'dark'
    const el = document.documentElement
    const fadeGeneration = ++artFadeGeneration
    resetArtFadeClasses(el)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startVT = (
      document as Document & {
        startViewTransition?: (cb: () => void | Promise<void>) => unknown
      }
    ).startViewTransition

    if (reduce || typeof startVT !== 'function' || x == null || y == null) {
      if (fadeCarouselArt && !reduce) el.classList.add(ART_FADE_ENTER_CLASS)
      setMode(next)
      if (fadeCarouselArt && !reduce) {
        void nextTick().then(() => {
          if (fadeGeneration === artFadeGeneration) releaseArtFade(el, false)
        })
      }
      return
    }

    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )
    // Chrome 的 ::view-transition-new(root) 渲染盒可能不等于 100vw×100vh，
    // px 值在盒尺寸偏差时会错位。改用百分比，circle() 百分比以元素自身盒为准，
    // 坐标和半径自动等比缩放，各浏览器行为一致。
    const px = (x / window.innerWidth) * 100
    const py = (y / window.innerHeight) * 100
    // circle() 百分比半径参照 √(w²+h²) / √2，
    // 因此 pr = endRadius × √2 / hypot(w,h) × 100
    const pr = (endRadius * Math.SQRT2) / Math.hypot(window.innerWidth, window.innerHeight) * 100
    el.style.setProperty('--vt-x', `${px}%`)
    el.style.setProperty('--vt-y', `${py}%`)
    el.style.setProperty('--vt-r', `${pr}%`)

    // 回调返回 Promise（等 Vue flush），确保新主题的 DOM 更新被截入过渡快照
    const vt = startVT.call(document, async () => {
      if (fadeCarouselArt) el.classList.add(ART_FADE_HOLD_CLASS)
      setMode(next)
      await nextTick()
    }) as { finished?: Promise<unknown> }
    // 快速双击时前一个过渡被跳过，其 promise 会 reject —— 吞掉避免控制台噪音
    if (vt?.finished) {
      if (!fadeCarouselArt) {
        void vt.finished.catch(() => {})
        return
      }
      void vt.finished.then(
        () => {
          if (fadeGeneration === artFadeGeneration) releaseArtFade(el, true)
        },
        () => {
          if (fadeGeneration === artFadeGeneration) releaseArtFade(el, true)
        },
      )
    } else {
      if (fadeCarouselArt && fadeGeneration === artFadeGeneration) releaseArtFade(el, true)
    }
  }

  // 跟随系统偏好变化（仅当 mode=system 时生效）
  mql.addEventListener('change', (e) => {
    systemDark.value = e.matches
    if (mode.value === 'system') applyClass()
  })

  // 初始应用（与 index.html 内联脚本一致，避免首屏闪烁）
  applyClass()

  return { mode, isDark, setMode, toggle }
})
