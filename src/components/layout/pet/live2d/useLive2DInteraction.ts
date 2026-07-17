/**
 * Live2D 交互 composable — 鼠标跟踪、眨眼、拖拽。
 *
 * 关键修复：参数设置 API 在 coreModel 上，不在 internalModel 上。
 * model.internalModel.coreModel.setParameterValueById(id, value)
 *
 * 鼠标跟踪：ParamAngleX/Y/Z + ParamEyeBallX/Y（平滑插值）
 * 眨眼：ParamEyeLOpen/ROpen（周期自动眨眼，与 Cubism eyeBlink 互补）
 */
import { type Ref } from 'vue'
import { LIVE2D_W, LIVE2D_H } from './useLive2DModel'

const TRACKING_SMOOTH = 0.06
const ANGLE_X_RANGE = 20
const ANGLE_Y_RANGE = 10
const ANGLE_Z_RANGE = 6
const EYEBALL_RANGE = 0.5

/** 眨眼参数 */
const BLINK_INTERVAL_MIN = 2500
const BLINK_INTERVAL_MAX = 6000
const BLINK_CLOSE_MS = 90

export function useLive2DInteraction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pixiAppRef: Ref<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelRef: Ref<any>,
  pos: Ref<{ x: number; y: number }>,
  moved: Ref<boolean>,
  onTurn?: () => void,
) {
  // turn 检测：鼠标静止超时后首次大幅移动 → 触发 turn 台词
  let lastMouseMove = 0
  let mouseIdleTurnFired = false

  let targetAngleX = 0
  let targetAngleY = 0
  let targetAngleZ = 0
  let targetEyeBallX = 0
  let targetEyeBallY = 0

  let dragging = false
  let dragStartClientX = 0
  let dragStartClientY = 0
  let dragStartPosX = 0
  let dragStartPosY = 0

  let tickerFn: (() => void) | null = null

  // 眨眼状态机
  let blinkTimer: ReturnType<typeof setTimeout> | null = null
  let eyeClosed = false

  /** 获取 coreModel（参数方法在此对象上） */
  function getCoreModel(): Record<string, unknown> | null {
    const m = modelRef.value
    if (!m?.internalModel?.coreModel) return null
    return m.internalModel.coreModel as Record<string, unknown>
  }

  /** 安全设置 Live2D 参数 */
  function setParam(id: string, value: number): boolean {
    const core = getCoreModel()
    if (!core) return false
    const fn = core.setParameterValueById as
      ((id: string, value: number, weight?: number) => void) | undefined
    fn?.call(core, id, value, 1)
    return true
  }

  /** 安全读取 Live2D 参数 */
  function getParam(id: string): number {
    const core = getCoreModel()
    if (!core) return 0
    const fn = core.getParameterValueById as
      ((id: string) => number) | undefined
    return fn?.call(core, id) ?? 0
  }

  function getContainerRect(): DOMRect | null {
    const app = pixiAppRef.value
    if (!app) return null
    const canvas = app.view as HTMLCanvasElement
    return canvas?.getBoundingClientRect() ?? null
  }

  function mouseToParams(clientX: number, clientY: number) {
    // turn 检测：10s 无鼠标 → 再次移动时触发一次
    if (onTurn) {
      const now = performance.now()
      if (!mouseIdleTurnFired && now - lastMouseMove > 10000) {
        mouseIdleTurnFired = true
        onTurn()
      }
      lastMouseMove = now
    }
    const rect = getContainerRect()
    if (!rect) return
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    targetAngleX = (nx - 0.5) * 2 * ANGLE_X_RANGE
    targetAngleY = -(ny - 0.5) * 2 * ANGLE_Y_RANGE
    targetAngleZ = (nx - 0.5) * 2 * ANGLE_Z_RANGE
    targetEyeBallX = (nx - 0.5) * 2 * EYEBALL_RANGE
    targetEyeBallY = (ny - 0.5) * 2 * EYEBALL_RANGE
  }

  /** ===== 眨眼系统 ===== */
  function scheduleBlink() {
    if (blinkTimer) clearTimeout(blinkTimer)
    blinkTimer = setTimeout(doBlink, BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN))
  }

  let blinkTracking = true

  function doBlink() {
    if (!blinkTracking || eyeClosed) return // B18: 停止跟踪后不再复活眨眼链
    eyeClosed = true
    // 闭眼
    setParam('ParamEyeLOpen', 0)
    setParam('ParamEyeROpen', 0)
    // 睁眼
    setTimeout(() => {
      setParam('ParamEyeLOpen', 1)
      setParam('ParamEyeROpen', 1)
      eyeClosed = false
      scheduleBlink()
    }, BLINK_CLOSE_MS)
  }

  /** ===== ticker 帧循环 ===== */
  function startTracking() {
    stopTracking()
    blinkTracking = true // B18: 启动新的眨眼周期

    const app = pixiAppRef.value
    if (!app?.ticker) return

    tickerFn = () => {
      const lerp = (cur: number, tgt: number) => cur + (tgt - cur) * TRACKING_SMOOTH
      setParam('ParamAngleX', lerp(getParam('ParamAngleX'), targetAngleX))
      setParam('ParamAngleY', lerp(getParam('ParamAngleY'), targetAngleY))
      setParam('ParamAngleZ', lerp(getParam('ParamAngleZ'), targetAngleZ))
      setParam('ParamEyeBallX', lerp(getParam('ParamEyeBallX'), targetEyeBallX))
      setParam('ParamEyeBallY', lerp(getParam('ParamEyeBallY'), targetEyeBallY))
    }

    app.ticker.add(tickerFn)
    scheduleBlink()
  }

  function stopTracking() {
    blinkTracking = false // B18: 停止后不再复活眨眼
    if (tickerFn) {
      const app = pixiAppRef.value
      if (app?.ticker) app.ticker.remove(tickerFn)
      tickerFn = null
    }
    if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null }
    eyeClosed = false
    setParam('ParamEyeLOpen', 1)
    setParam('ParamEyeROpen', 1)
  }

  function onGlobalMouseMove(e: MouseEvent) {
    mouseToParams(e.clientX, e.clientY)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return // B17: 只响应左键，右键留给 ContextMenu
    dragging = true
    moved.value = false
    dragStartClientX = e.clientX
    dragStartClientY = e.clientY
    dragStartPosX = pos.value.x
    dragStartPosY = pos.value.y
    const canvas = pixiAppRef.value?.view as HTMLElement
    if (canvas) {
      try { canvas.setPointerCapture(e.pointerId) } catch { /* noop */ }
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - dragStartClientX
    const dy = e.clientY - dragStartClientY
    if (Math.hypot(dx, dy) > 4) moved.value = true
    if (moved.value) {
      pos.value = {
        x: Math.max(0, Math.min(window.innerWidth - LIVE2D_W, dragStartPosX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - LIVE2D_H, dragStartPosY + dy)),
      }
    }
  }

  function onPointerUp() { dragging = false }

  function startMouseTracking() {
    lastMouseMove = performance.now()
    mouseIdleTurnFired = false
    window.addEventListener('mousemove', onGlobalMouseMove)
    startTracking()
  }

  function stopMouseTracking() {
    window.removeEventListener('mousemove', onGlobalMouseMove)
    stopTracking()
  }

  /** B9: 唱歌时暂停鼠标跟踪的 ParamAngle 写入，避免与唱歌摇头冲突 */
  function pauseTracking() {
    window.removeEventListener('mousemove', onGlobalMouseMove)
    stopTracking()
  }
  function resumeTracking() {
    window.addEventListener('mousemove', onGlobalMouseMove)
    startTracking()
  }

  return {
    startMouseTracking,
    stopMouseTracking,
    pauseTracking,
    resumeTracking,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
