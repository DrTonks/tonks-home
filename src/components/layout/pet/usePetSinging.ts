/**
 * 桌宠唱歌状态机 + 音符特效
 */
import { watch } from 'vue'
import { useMusicStore } from '@/stores/music'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'
import { type PetState, type Singing, W, FRAMES, NOTE_SYMBOLS } from './state'

const SINGING_TRANSITIONS: Record<Singing, { next: Singing; prob: number }[]> = {
  'singing-1': [{ next: 'singing-2', prob: 0.4 }, { next: 'singing-4', prob: 0.6 }],
  'singing-2': [{ next: 'singing-1', prob: 0.5 }, { next: 'singing-3', prob: 0.5 }],
  'singing-3': [{ next: 'singing-2', prob: 0.4 }, { next: 'singing-4', prob: 0.6 }],
  'singing-4': [{ next: 'singing-3', prob: 0.4 }, { next: 'singing-1', prob: 0.6 }],
}

function pickNextSinging(from: Singing): Singing {
  const r = Math.random()
  let cum = 0
  for (const t of SINGING_TRANSITIONS[from]) {
    cum += t.prob
    if (r < cum) return t.next
  }
  return SINGING_TRANSITIONS[from][0].next
}

export function usePetSinging(state: PetState, onSingingExit: () => void) {
  const store = useMusicStore()
  const { hasSignal, startSignalCheck, stopSignalCheck } = useAudioAnalyzer()
  const { t, c } = state

  function spawnSingingNotes(count: number) {
    const notes = Array.from({ length: count }, () => ({
      id: ++c.singingNoteId,
      x: W * 0.2 + Math.random() * W * 0.7,
      y: -10 + Math.random() * 40,
      symbol: NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)],
      hue: Math.random() * 360,
      delay: Math.random() * 300,
    }))
    state.singingNotes.value = [...state.singingNotes.value, ...notes]
    setTimeout(() => {
      state.singingNotes.value = state.singingNotes.value.filter((n) => !notes.includes(n))
    }, 2500)
  }

  function scheduleSingingNext() {
    if (t.singingTimer) clearTimeout(t.singingTimer)
    if (c.musicStopped && state.singingState.value === 'singing-1') {
      state.singingState.value = null
      state.showFrame.value = FRAMES.idle
      onSingingExit()
      return
    }
    t.singingTimer = setTimeout(() => {
      if (!state.singingState.value) return
      const next = pickNextSinging(state.singingState.value)
      state.singingState.value = next
      state.showFrame.value = FRAMES[next]
      spawnSingingNotes(3)
      if (Math.random() < 0.5) {
        state.action.value = Math.random() < 0.5 ? 'sway' : 'bounce'
        state.actionProgress.value = 0
        const dur = 1200
        const tick = () => {
          state.actionProgress.value += 16 / dur
          if (state.actionProgress.value < 1) requestAnimationFrame(tick)
          else { state.action.value = 'idle'; state.actionProgress.value = 0 }
        }
        requestAnimationFrame(tick)
      }
      scheduleSingingNext()
    }, 700 + Math.random() * 2300)
  }

  function startSinging() {
    if (state.mood.value === 'threat') return
    c.musicStopped = false
    if (t.sleepZTrainer) { clearInterval(t.sleepZTrainer); t.sleepZTrainer = null }
    if (t.blinkTimer) { clearTimeout(t.blinkTimer); t.blinkTimer = null }
    if (t.actionTimer) { clearTimeout(t.actionTimer); t.actionTimer = null }
    if (t.idleTimer) { clearTimeout(t.idleTimer); t.idleTimer = null }
    if (t.sleepTimer) { clearTimeout(t.sleepTimer); t.sleepTimer = null }
    state.mood.value = 'idle'
    state.singingState.value = 'singing-1'
    state.showFrame.value = FRAMES['singing-1']
    spawnSingingNotes(5)
    state.action.value = 'bounce'
    state.actionProgress.value = 0
    ;(function tick() {
      state.actionProgress.value += 16 / 1200
      if (state.actionProgress.value < 1) requestAnimationFrame(tick)
      else { state.action.value = 'idle'; state.actionProgress.value = 0 }
    })()
    scheduleSingingNext()
  }

  function handleMusicStop() {
    c.musicStopped = true
    if (!state.singingState.value) return
    if (state.singingState.value !== 'singing-1') {
      state.singingState.value = 'singing-1'
      state.showFrame.value = FRAMES['singing-1']
    }
    scheduleSingingNext()
  }

  function stopAllSinging() {
    if (t.singingTimer) { clearTimeout(t.singingTimer); t.singingTimer = null }
    state.singingState.value = null
    state.singingNotes.value = []
  }

  function tryResumeSinging() {
    if (store.isPlaying && !state.rageActive.value && state.mood.value !== 'threat') {
      startSinging()
    }
  }

  watch(() => store.isPlaying, (playing) => {
    if (state.rageActive.value) return
    if (playing) startSignalCheck()
    else { stopSignalCheck(); handleMusicStop() }
  })

  watch(hasSignal, (active) => {
    if (!store.isPlaying || state.rageActive.value) return
    if (active) startSinging()
  })

  return { spawnSingingNotes, startSinging, stopAllSinging, tryResumeSinging }
}
