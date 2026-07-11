import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'theme'
const mql = window.matchMedia('(prefers-color-scheme: dark)')

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')
  const systemDark = ref(mql.matches)

  const isDark = computed(
    () => mode.value === 'dark' || (mode.value === 'system' && systemDark.value),
  )

  function applyClass() {
    document.documentElement.classList.toggle('dark', isDark.value)
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
  function toggle(x?: number, y?: number) {
    const next: ThemeMode = isDark.value ? 'light' : 'dark'

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startVT = (
      document as Document & {
        startViewTransition?: (cb: () => void | Promise<void>) => unknown
      }
    ).startViewTransition

    if (reduce || typeof startVT !== 'function' || x == null || y == null) {
      setMode(next)
      return
    }

    const el = document.documentElement
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )
    el.style.setProperty('--vt-x', `${x}px`)
    el.style.setProperty('--vt-y', `${y}px`)
    el.style.setProperty('--vt-r', `${endRadius}px`)

    // 回调返回 Promise（等 Vue flush），确保新主题的 DOM 更新被截入过渡快照
    const vt = startVT.call(document, async () => {
      setMode(next)
      await nextTick()
    }) as { finished?: Promise<unknown> }
    // 快速双击时前一个过渡被跳过，其 promise 会 reject —— 吞掉避免控制台噪音
    vt?.finished?.catch(() => {})
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
