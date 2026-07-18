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
import { SLEEP_EYE_OPEN } from './state'

const TRACKING_SMOOTH = 0.1   // 头部跟踪灵敏度（越大越快）
const BODY_SMOOTH = 0.04       // 身体比头慢半拍
const ANGLE_X_RANGE = 35       // 头左右
const ANGLE_Y_RANGE = 22       // 头上下
const ANGLE_Z_RANGE = 14       // 头倾斜
const EYEBALL_RANGE = 0.8      // 眼球转动范围
const BODY_X_RANGE = 18        // 身体左右
const BODY_Y_RANGE = 10        // 身体前后
const BODY_Z_RANGE = 8         // 身体倾斜
const BREATH_AMPLITUDE = 0.3   // 呼吸幅度

/** 眨眼参数 */
const BLINK_INTERVAL_MIN = 2500
const BLINK_INTERVAL_MAX = 6000
const BLINK_CLOSE_MS = 90

/** 睡眠偷瞄参数 */
const PEEK_INTERVAL_MIN = 5000 // 两次偷瞄间隔下限
const PEEK_INTERVAL_MAX = 10000 // 上限
const PEEK_HOLD_MIN = 1000     // 单次偷瞄持续下限
const PEEK_HOLD_MAX = 2000     // 上限
const PEEK_EYE_OPEN = 0.7      // 偷瞄时右眼睁开程度

/** 掷出下一次偷瞄的时间点 */
function rollNextPeek(now: number) {
  return now + PEEK_INTERVAL_MIN + Math.random() * (PEEK_INTERVAL_MAX - PEEK_INTERVAL_MIN)
}

export function useLive2DInteraction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pixiAppRef: Ref<any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelRef: Ref<any>,
  pos: Ref<{ x: number; y: number }>,
  moved: Ref<boolean>,
  onTurn?: () => void,
  isAsleep?: Ref<boolean>,
) {
  // turn 检测：鼠标静止超时后首次大幅移动 → 触发 turn 台词
  let lastMouseMove = 0
  let mouseIdleTurnFired = false

  let targetAngleX = 0
  let targetAngleY = 0
  let targetAngleZ = 0
  let targetEyeBallX = 0
  let targetEyeBallY = 0
  let targetBodyX = 0
  let targetBodyY = 0
  let targetBodyZ = 0
  let breathPhase = Math.random() * Math.PI * 2
  let baseBodyY = 0 // 分离呼吸与跟踪，避免 breath 逐帧累积

  // 睡眠偷瞄状态机（在 beforeModelUpdate 回调中驱动；nextPeekAt===0 → 待播种）
  let nextPeekAt = 0
  let peekUntil = 0

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
    // 身体旋转跟随头部，幅度略小（模拟 vtuber 全身联动）
    targetBodyX = (nx - 0.5) * 2 * BODY_X_RANGE
    targetBodyY = -(ny - 0.5) * 2 * BODY_Y_RANGE
    targetBodyZ = (nx - 0.5) * 2 * BODY_Z_RANGE
  }

  /** ===== 眨眼系统 ===== */
  function scheduleBlink() {
    if (!blinkTracking || isAsleep?.value) return // 睡眠/已停跟踪时不调度（审查发现：卸载时 90ms 孤儿 timeout 会复活链）
    if (blinkTimer) clearTimeout(blinkTimer)
    blinkTimer = setTimeout(doBlink, BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN))
  }

  let blinkTracking = true

  function doBlink() {
    if (isAsleep?.value || !blinkTracking || eyeClosed) return // 睡眠时不眨眼
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

  /** beforeModelUpdate 回调：在 motion/expression/eyeBlink 之后、顶点计算之前设置睡眠闭眼 */
  function onBeforeModelUpdate() {
    if (!isAsleep?.value) {
      // 清醒：重置偷瞄状态机
      nextPeekAt = 0
      peekUntil = 0
      return
    }

    const now = performance.now()
    // nextPeekAt===0 → 刚进入睡眠，播种下次偷瞄时间
    if (nextPeekAt === 0) {
      nextPeekAt = rollNextPeek(now)
    }
    // 到点 → 开始一次偷瞄
    if (peekUntil === 0 && now >= nextPeekAt) {
      peekUntil = now + PEEK_HOLD_MIN + Math.random() * (PEEK_HOLD_MAX - PEEK_HOLD_MIN)
    }

    const eyeR = now < peekUntil ? PEEK_EYE_OPEN : SLEEP_EYE_OPEN

    // 偷瞄结束 → 规划下一次
    if (peekUntil !== 0 && now >= peekUntil) {
      peekUntil = 0
      nextPeekAt = rollNextPeek(now)
    }

    setParam('ParamEyeLOpen', SLEEP_EYE_OPEN)
    setParam('ParamEyeROpen', eyeR)
  }

  /** ===== ticker 帧循环 ===== */
  function startTracking() {
    stopTracking()
    blinkTracking = true // B18: 启动新的眨眼周期

    const app = pixiAppRef.value
    if (!app?.ticker) return

    tickerFn = () => {
      const lerp = (cur: number, tgt: number) => cur + (tgt - cur) * TRACKING_SMOOTH
      const bLerp = (cur: number, tgt: number) => cur + (tgt - cur) * BODY_SMOOTH
      // 睡眠时追踪目标衰减回中立（保留呼吸），避免"睡着"还扭头跟随鼠标
      const tgtX = isAsleep?.value ? 0 : targetAngleX
      const tgtY = isAsleep?.value ? 0 : targetAngleY
      const tgtZ = isAsleep?.value ? 0 : targetAngleZ
      const tgtEBX = isAsleep?.value ? 0 : targetEyeBallX
      const tgtEBY = isAsleep?.value ? 0 : targetEyeBallY
      const tgtBX = isAsleep?.value ? 0 : targetBodyX
      const tgtBY = isAsleep?.value ? 0 : targetBodyY
      const tgtBZ = isAsleep?.value ? 0 : targetBodyZ
      // 头部旋转
      setParam('ParamAngleX', lerp(getParam('ParamAngleX'), tgtX))
      setParam('ParamAngleY', lerp(getParam('ParamAngleY'), tgtY))
      setParam('ParamAngleZ', lerp(getParam('ParamAngleZ'), tgtZ))
      setParam('ParamEyeBallX', lerp(getParam('ParamEyeBallX'), tgtEBX))
      setParam('ParamEyeBallY', lerp(getParam('ParamEyeBallY'), tgtEBY))
      // 身体旋转（跟随头部但更慢，模拟全身联动）
      setParam('ParamBodyAngleX', bLerp(getParam('ParamBodyAngleX'), tgtBX))
      baseBodyY += (tgtBY - baseBodyY) * BODY_SMOOTH
      setParam('ParamBodyAngleZ', bLerp(getParam('ParamBodyAngleZ'), tgtBZ))
      // 呼吸：缓慢正弦波叠加在身体 Y 上（睡眠时也保留）
      breathPhase += 0.015
      setParam('ParamBodyAngleY', baseBodyY + Math.sin(breathPhase) * BREATH_AMPLITUDE)
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

  /** sleep→awake 时重置眨眼链（由外部在 mood 变化后调用） */
  function resumeBlink() {
    if (isAsleep?.value) return
    blinkTracking = true
    scheduleBlink()
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

    // 安装睡眠闭眼钩子（mount 后仅一次；唱歌 pauseTracking 不触碰钩子，唱歌 rAF 与钩子独立并行）
    const im = modelRef.value?.internalModel as Record<string, unknown> | null
    ;(im as any)?.on?.('beforeModelUpdate', onBeforeModelUpdate)
  }

  function stopMouseTracking() {
    window.removeEventListener('mousemove', onGlobalMouseMove)
    stopTracking()
    // 对称：卸载睡眠闭眼钩子
    const im = modelRef.value?.internalModel as Record<string, unknown> | null
    ;(im as any)?.off?.('beforeModelUpdate', onBeforeModelUpdate)
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
    resumeBlink,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
