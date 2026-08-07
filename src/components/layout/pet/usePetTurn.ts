/**
 * 桌宠转身 / 鼠标跟踪系统
 */
import { watch, onBeforeUnmount } from 'vue'
import { type PetState, W, FRAMES, TURN_FRAME_PATH } from './state'

export function usePetTurn(state: PetState, onTrackingExit: () => void) {
  const { t, c } = state
  const MOUSE_IDLE_MS = 10000
  const MOUSE_MAX_IDLE_MS = 120000
  const TURN_COOLDOWN_MS = 60000  // tracking 结束后的转身冷却
  const TRACKING_MIN_MS = 5000
  const TRACKING_MAX_MS = 10000

  let mouseCheckTimer: ReturnType<typeof setInterval> | null = null

  function clearTurnOneShot() {
    if (t.turnOneShot) {
      window.removeEventListener('mousemove', t.turnOneShot)
      t.turnOneShot = null
    }
  }

  function returnToIdle() {
    state.turnDirection.value = null
    state.showFrame.value = FRAMES[state.mood.value]
    t.blinking = false
  }

  function resetMouseTracking() {
    if (t.trackingEndTimer) { clearTimeout(t.trackingEndTimer); t.trackingEndTimer = null }
    clearTurnOneShot()
    state.tracking.value = false
    returnToIdle()
  }

  function onMouseMove(e: MouseEvent) {
    c.mouseX = e.clientX
    c.mouseY = e.clientY
    c.mouseLastMove = performance.now()
  }

  function mouseXDir(): 'left' | 'right' | 'over' {
    const petX = state.pos.value.x
    const mx = c.mouseX
    if (mx >= petX && mx <= petX + W) return 'over'
    return mx < petX ? 'left' : 'right'
  }

  function doTurn(dir: 'left' | 'right') {
    t.blinking = true
    state.turnDirection.value = dir
    state.showFrame.value = TURN_FRAME_PATH
  }

  function startTracking() {
    if (state.rageActive.value || state.singingState.value) return
    state.tracking.value = true
    const dur = TRACKING_MIN_MS + Math.random() * (TRACKING_MAX_MS - TRACKING_MIN_MS)

    // 转身计数器：光标反复横扫/转圈 → 累积转身 → 超过阈值才生气
    const TURN_ANGER_THRESHOLD = 10
    let turnCount = 0
    let prevTurnDir: 'left' | 'right' | null = null
    let firstTransition = true

    function trackTick() {
      if (!state.tracking.value) return
      const dir = mouseXDir()
      const newTurnDir = dir === 'over' ? null : dir

      // 方向变化计数：跳过首次 transition（跟踪开始时的初始朝向），
      // 后续每次 direction ↔ null 转换计 1 次转身
      if (newTurnDir !== prevTurnDir) {
        if (firstTransition) {
          firstTransition = false
        } else {
          turnCount++
        }
        prevTurnDir = newTurnDir
      }

      if (dir === 'left') {
        state.turnDirection.value = 'left'
        state.showFrame.value = TURN_FRAME_PATH
      } else if (dir === 'right') {
        state.turnDirection.value = 'right'
        state.showFrame.value = TURN_FRAME_PATH
      } else {
        state.turnDirection.value = null
        state.showFrame.value = FRAMES.idle
      }
      if (state.tracking.value) requestAnimationFrame(trackTick)
    }

    t.trackingEndTimer = setTimeout(() => {
      state.tracking.value = false
      t.trackingEndTimer = null
      state.turnDirection.value = null
      t.blinking = false
      // 转身超过阈值 → 被调戏了，生气；否则平静回到 idle
      if (turnCount >= TURN_ANGER_THRESHOLD) {
        state.showFrame.value = FRAMES.angry
        state.mood.value = 'angry'
        setTimeout(() => {
          if (state.mood.value === 'angry') {
            state.mood.value = 'idle'
            state.showFrame.value = FRAMES.idle
            onTrackingExit()
          }
        }, 1500)
      } else {
        state.showFrame.value = FRAMES.idle
        state.mood.value = 'idle'
        onTrackingExit()
      }
    }, dur)

    requestAnimationFrame(trackTick)
  }

  function checkMouseIdle() {
    if (state.singingState.value || state.rageActive.value || state.tracking.value) return
    if (state.mood.value !== 'idle') return

    const idleTime = performance.now() - c.mouseLastMove
    if (idleTime < MOUSE_IDLE_MS) return

    // tracking 结束 1min 冷却期内不触发转身
    if (c.lastTrackingEnd && performance.now() - c.lastTrackingEnd < TURN_COOLDOWN_MS) return

    if (idleTime >= MOUSE_MAX_IDLE_MS) {
      resetMouseTracking()
      return
    }

    const dir = mouseXDir()
    if (dir === 'over') return

    doTurn(dir)

    clearTurnOneShot()
    t.turnOneShot = (e: MouseEvent) => {
      c.mouseX = e.clientX
      c.mouseLastMove = performance.now()
      clearTurnOneShot()
      returnToIdle()
      startTracking()
    }
    window.addEventListener('mousemove', t.turnOneShot)
  }

  function startMouseSystem() {
    window.addEventListener('mousemove', onMouseMove)
    c.mouseLastMove = performance.now()
    mouseCheckTimer = setInterval(checkMouseIdle, 500)
  }

  function stopMouseSystem() {
    window.removeEventListener('mousemove', onMouseMove)
    if (mouseCheckTimer) { clearInterval(mouseCheckTimer); mouseCheckTimer = null }
    resetMouseTracking()
  }

  // cry/sleep → 清空当前转身/跟踪状态
  watch(() => state.mood.value, (m) => {
    if (m === 'cry' || m === 'sleep') resetMouseTracking()
  })

  // tracking → false 时记录时间戳（1min 冷却）。唱歌退出不算真正的 tracking 结束
  watch(() => state.tracking.value, (v, prev) => {
    if (!v && prev && !state.singingState.value) c.lastTrackingEnd = performance.now()
  })

  onBeforeUnmount(() => stopMouseSystem())

  return { startMouseSystem, stopMouseSystem, resetMouseTracking, clearTurnOneShot }
}
