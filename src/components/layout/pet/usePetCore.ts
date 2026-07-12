/**
 * 桌宠核心逻辑：物理/眨眼/动作/情绪/点击升级/闲置计时/拖拽/粒子/暴怒
 */
import { onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'
import {
  type PetState,
  W, H, PHYSICS, FRAMES, BLINK_SEQ, TIER_CONFIG,
  CLICK_TIMEOUT_MS, CRY_AFTER_MS, SLEEP_AFTER_MS,
  RAGE_CLICK_MIN, RAGE_CLICK_MAX,
  rollThreshold, scale,
} from './state'

export function usePetCore(
  state: PetState,
  petRef: Ref<HTMLElement | null>,
  emit: (e: 'rage' | 'rageStart') => void,
  onResumeSinging: () => void,
) {
  const { t, c } = state

  function resetClickTiers() {
    c.tierThresholds = TIER_CONFIG.map((ti) => rollThreshold(ti.minClicks, ti.maxClicks))
    c.clickCount = 0
  }

  function resetRageThreshold() {
    c.rageThreshold = rollThreshold(RAGE_CLICK_MIN, RAGE_CLICK_MAX)
    c.rageClicks = 0
  }

  // ===== 物理计算（纯函数，每帧在 tick 内调用，不依赖 Vue 响应式） =====
  function calcPhysTransform(): string {
    const p = PHYSICS[state.mood.value]
    const breath = Math.sin(c.phase) * p.breathAmp
    const bob = p.bobAmp > 0 ? Math.sin(c.phase * (p.bobHz / Math.max(0.01, p.breathHz))) * p.bobAmp : 0
    const shake = Math.sin(c.shakePhase * 4) * (state.rageActive.value ? 2.4 : p.shake)
    const ap = state.actionProgress.value
    const wave = Math.sin(Math.max(0, ap) * Math.PI * 2)
    const sway = state.action.value === 'sway' ? wave * scale(5) : 0
    const bounce = state.action.value === 'bounce' ? -Math.abs(wave) * scale(8) : 0
    return `scale(${(1 + breath) * state.rageScale.value}) translateY(${bob + bounce}px) translateX(${shake + sway}px)`
  }

  // ===== 帧循环 =====
  function tick(now: number) {
    const dt = Math.min(0.1, (now - c.lastTick) / 1000)
    c.lastTick = now
    const p = PHYSICS[state.mood.value]
    c.phase += dt * p.breathHz * Math.PI * 2
    c.shakePhase += dt * 4 * Math.PI * 2
    if (petRef.value) {
      petRef.value.style.transform = calcPhysTransform()
    }
    t.rafId = requestAnimationFrame(tick)
  }

  // ===== 眨眼 =====
  function scheduleBlink() {
    if (state.singingState.value || state.turnDirection.value !== null) return
    if (t.blinkTimer) clearTimeout(t.blinkTimer)
    t.blinkTimer = setTimeout(() => {
      if (t.blinking || state.turnDirection.value !== null || state.dragging.value || state.mood.value === 'sleep') { scheduleBlink(); return }
      t.blinking = true
      let idx = 0
      function step() {
        if (idx >= BLINK_SEQ.length) {
          state.showFrame.value = FRAMES[state.mood.value]
          t.blinking = false
          scheduleBlink()
          return
        }
        state.showFrame.value = BLINK_SEQ[idx++].src
        t.blinkStepId = setTimeout(step, BLINK_SEQ[idx - 1]?.duration || 80)
      }
      step()
    }, 3500 + Math.random() * 5000)
  }

  // ===== 动作（sway/bounce） =====
  function scheduleAction() {
    if (state.singingState.value || state.turnDirection.value !== null) return
    if (t.actionTimer) clearTimeout(t.actionTimer)
    t.actionTimer = setTimeout(() => {
      if (state.turnDirection.value !== null || state.dragging.value || state.mood.value === 'sleep' || state.mood.value === 'cry') { scheduleAction(); return }
      state.action.value = Math.random() < 0.55 ? 'sway' : 'bounce'
      state.actionProgress.value = 0
      if (state.mood.value === 'idle' && !state.turnDirection.value) {
        state.showFrame.value = Math.random() < 0.45 ? FRAMES.happy : FRAMES.idle
      }
      const dur = 1400
      const step = () => {
        state.actionProgress.value += 16 / dur
        if (state.actionProgress.value < 1) t.actionRafId = requestAnimationFrame(step)
        else {
          state.action.value = 'idle'
          t.actionRafId = null
          if (state.mood.value === 'idle' && !state.turnDirection.value) state.showFrame.value = FRAMES.idle
          scheduleAction()
        }
      }
      t.actionRafId = requestAnimationFrame(step)
    }, 4500 + Math.random() * 6500)
  }

  // ===== 闲置计时 =====
  function resetIdleTimers() {
    if (t.idleTimer) clearTimeout(t.idleTimer)
    if (t.sleepTimer) clearTimeout(t.sleepTimer)
    if (state.mood.value === 'cry' || state.mood.value === 'sleep') {
      state.mood.value = 'idle'
      state.showFrame.value = FRAMES.idle
      scheduleBlink()
      scheduleAction()
      stopSleepZs()
      onResumeSinging()
    }
    t.idleTimer = setTimeout(() => {
      if (state.mood.value === 'idle') {
        state.mood.value = 'cry'
        state.showFrame.value = FRAMES.cry
        if (t.blinkTimer) clearTimeout(t.blinkTimer)
        if (t.actionTimer) clearTimeout(t.actionTimer)
      }
    }, CRY_AFTER_MS)
    t.sleepTimer = setTimeout(() => {
      if (state.mood.value === 'cry' || state.mood.value === 'idle') {
        state.mood.value = 'sleep'
        state.showFrame.value = FRAMES.sleep
        if (t.blinkTimer) clearTimeout(t.blinkTimer)
        if (t.actionTimer) clearTimeout(t.actionTimer)
        startSleepZs()
      }
    }, SLEEP_AFTER_MS)
  }

  // ===== 粒子 =====
  function spawnParticles(count: number, clickX?: number, clickY?: number) {
    const cx = clickX ?? W / 2
    const cy = clickY ?? H / 2
    const newParticles = Array.from({ length: count }, () => ({
      id: ++c.particleId,
      originX: cx + (Math.random() - 0.5) * 16,
      originY: cy + (Math.random() - 0.5) * 16,
      dx: (Math.random() - 0.5) * 200,
      dy: (Math.random() - 0.5) * 200 - 50,
      delay: Math.random() * 120,
    }))
    state.particles.value = [...state.particles.value, ...newParticles]
    setTimeout(() => { state.particles.value = state.particles.value.filter((p) => !newParticles.includes(p)) }, 1000)
  }

  // ===== 睡眠 Z =====
  function spawnSleepZ() {
    const z = {
      id: ++c.sleepZId,
      x: W * 0.4 + Math.random() * W * 0.5,
      y: -10 + Math.random() * 30,
      text: Math.random() < 0.4 ? 'Z' : 'z',
      delay: Math.random() * 400,
    }
    state.sleepZs.value = [...state.sleepZs.value, z]
    setTimeout(() => { state.sleepZs.value = state.sleepZs.value.filter((s) => s.id !== z.id) }, 2800)
  }

  function startSleepZs() {
    if (t.sleepZTrainer) return
    spawnSleepZ()
    t.sleepZTrainer = setInterval(spawnSleepZ, 900)
  }

  function stopSleepZs() {
    if (t.sleepZTrainer) { clearInterval(t.sleepZTrainer); t.sleepZTrainer = null }
  }

  // ===== 暴怒 =====
  function startRage() {
    state.rageActive.value = true
    emit('rageStart') // 暴怒开始（2.5s 动画）—— 供背景睁眼动画等外部联动
    state.turnDirection.value = null
    state.tracking.value = false
    t.blinking = false
    if (t.turnOneShot) { window.removeEventListener('mousemove', t.turnOneShot); t.turnOneShot = null }
    if (t.clickTimer) { clearTimeout(t.clickTimer); t.clickTimer = null }
    if (t.blinkTimer) { clearTimeout(t.blinkTimer); t.blinkTimer = null }
    if (t.blinkStepId) { clearTimeout(t.blinkStepId); t.blinkStepId = null }
    if (t.actionTimer) { clearTimeout(t.actionTimer); t.actionTimer = null }
    if (t.actionRafId !== null) { cancelAnimationFrame(t.actionRafId); t.actionRafId = null }
    if (t.singingRafId !== null) { cancelAnimationFrame(t.singingRafId); t.singingRafId = null }
    if (t.singingTimer) { clearTimeout(t.singingTimer); t.singingTimer = null }
    if (t.idleTimer) { clearTimeout(t.idleTimer); t.idleTimer = null }
    if (t.sleepTimer) { clearTimeout(t.sleepTimer); t.sleepTimer = null }
    state.rageScale.value = 1
    let start = performance.now()
    const dur = 2500
    function animRage(now: number) {
      const tt = Math.min(1, (now - start) / dur)
      c.shakePhase += 0.6
      state.rageScale.value = 1 + tt * 1
      if (tt < 1) {
        t.rageAnimId = requestAnimationFrame(animRage)
      } else {
        emit('rage')
        t.rageAnimId = null
        state.rageActive.value = false
        // 重置怒气状态，防止无限循环；恢复日常计时器
        resetClickTiers()
        resetRageThreshold()
        state.mood.value = 'idle'
        state.showFrame.value = FRAMES.idle
        state.singingState.value = null
        state.singingNotes.value = []
        resetIdleTimers()
        scheduleBlink()
        scheduleAction()
      }
    }
    t.rageAnimId = requestAnimationFrame(animRage)
  }

  // ===== 点击处理 =====
  function handleClick(e: MouseEvent) {
    if (state.moved.value) { state.moved.value = false; return }
    if (state.rageActive.value) return

    if (state.singingState.value) return

    // tracking 模式点击 → 直接退出 tracking，回 idle（不升级情绪）
    if (state.tracking.value) {
      if (t.trackingEndTimer) { clearTimeout(t.trackingEndTimer); t.trackingEndTimer = null }
      state.tracking.value = false
      state.turnDirection.value = null
      state.showFrame.value = FRAMES.idle
      state.mood.value = 'idle'
      t.blinking = false
      scheduleBlink()
      scheduleAction()
      resetIdleTimers()
      return
    }

    if (state.mood.value === 'sleep') {
      stopSleepZs()
      state.mood.value = 'angry'
      state.showFrame.value = FRAMES.angry
      c.clickCount = 0
      resetRageThreshold()
      if (t.clickTimer) clearTimeout(t.clickTimer)
      t.clickTimer = setTimeout(() => {
        resetClickTiers()
        state.mood.value = 'idle'
        state.showFrame.value = FRAMES.idle
        scheduleBlink()
        scheduleAction()
      }, CLICK_TIMEOUT_MS)
      return
    }

    resetIdleTimers()

    const el = petRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    spawnParticles(8, e.clientX - rect.left, e.clientY - rect.top)

    if (state.mood.value === 'threat') {
      c.rageClicks++
      if (c.rageClicks >= c.rageThreshold) { startRage(); return }
      if (t.clickTimer) clearTimeout(t.clickTimer)
      t.clickTimer = setTimeout(() => {
        resetClickTiers()
        resetRageThreshold()
        if (state.mood.value === 'threat') {
          state.mood.value = 'idle'
          state.showFrame.value = FRAMES.idle
          scheduleBlink()
          scheduleAction()
          onResumeSinging()
        }
      }, CLICK_TIMEOUT_MS)
      return
    }

    if (t.clickTimer) clearTimeout(t.clickTimer)
    c.clickCount++

    let currentTier = -1
    let cum = 0
    for (let i = 0; i < c.tierThresholds.length; i++) {
      cum += c.tierThresholds[i]
      if (c.clickCount >= cum) currentTier = i
      else break
    }

    if (currentTier >= 0) {
      state.mood.value = TIER_CONFIG[currentTier].mood
      state.showFrame.value = FRAMES[state.mood.value]
      if (t.blinkTimer) clearTimeout(t.blinkTimer)
      if (t.actionTimer) clearTimeout(t.actionTimer)
      resetRageThreshold()
    }

    t.clickTimer = setTimeout(() => {
      resetClickTiers()
      resetRageThreshold()
      const m = state.mood.value
      if (m !== 'cry' && m !== 'sleep') {
        state.mood.value = 'idle'
        state.showFrame.value = FRAMES.idle
        scheduleBlink()
        scheduleAction()
        if (m === 'threat') onResumeSinging()
      }
    }, CLICK_TIMEOUT_MS)
  }

  // ===== 拖拽 =====
  function onPointerDown(e: PointerEvent) {
    if (state.mood.value === 'threat' || state.rageActive.value) return
    // tracking 模式拖拽 → 退出 tracking 进日常
    if (state.tracking.value) {
      if (t.trackingEndTimer) { clearTimeout(t.trackingEndTimer); t.trackingEndTimer = null }
      state.tracking.value = false
      state.turnDirection.value = null
      state.showFrame.value = FRAMES.idle
      state.mood.value = 'idle'
      t.blinking = false
      scheduleBlink()
      scheduleAction()
    }
    if (!state.singingState.value) resetIdleTimers()
    state.dragging.value = true; state.moved.value = false
    c.startClientX = e.clientX; c.startClientY = e.clientY
    c.startPosX = state.pos.value.x; c.startPosY = state.pos.value.y
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
  }

  function onPointerMove(e: PointerEvent) {
    if (!state.dragging.value) return
    const dx = e.clientX - c.startClientX, dy = e.clientY - c.startClientY
    if (Math.hypot(dx, dy) > 4) state.moved.value = true
    if (state.moved.value) {
      if (state.singingState.value) {
        state.singingAngry.value = true
      } else {
        state.mood.value = 'angry'; state.showFrame.value = FRAMES.angry
        if (t.blinkTimer) clearTimeout(t.blinkTimer)
      }
      state.pos.value = {
        x: Math.max(0, Math.min(window.innerWidth - W, c.startPosX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - H, c.startPosY + dy)),
      }
    }
  }

  function onPointerUp() {
    if (!state.dragging.value) return
    state.dragging.value = false
    if (state.moved.value) {
      state.singingAngry.value = false
      if (!state.singingState.value) {
        state.mood.value = 'idle'; state.showFrame.value = FRAMES.idle
        scheduleBlink(); scheduleAction(); resetIdleTimers()
      }
      // 不在此清 moved：留给紧随其后的 click 事件（handleClick 检测到 moved 后忽略并清除），
      // 否则伪点击会被当作真点击。下次 onPointerDown 也会重置 moved。
    }
  }

  onMounted(() => {
    resetClickTiers()
    scheduleBlink()
    scheduleAction()
    resetIdleTimers()
    c.lastTick = performance.now()
    t.rafId = requestAnimationFrame(tick)
    setTimeout(() => spawnParticles(10, W / 2, H / 2), 300)
  })

  onBeforeUnmount(() => {
    if (t.blinkTimer) clearTimeout(t.blinkTimer)
    if (t.blinkStepId) clearTimeout(t.blinkStepId)
    if (t.clickTimer) clearTimeout(t.clickTimer)
    if (t.idleTimer) clearTimeout(t.idleTimer)
    if (t.sleepTimer) clearTimeout(t.sleepTimer)
    if (t.actionTimer) clearTimeout(t.actionTimer)
    if (t.actionRafId !== null) cancelAnimationFrame(t.actionRafId)
    if (t.rafId !== null) cancelAnimationFrame(t.rafId)
    if (t.rageAnimId !== null) cancelAnimationFrame(t.rageAnimId)
    stopSleepZs()
  })

  return {
    scheduleBlink, scheduleAction, resetIdleTimers,
    spawnParticles, startSleepZs, stopSleepZs,
    startRage, handleClick,
    onPointerDown, onPointerMove, onPointerUp,
  }
}
