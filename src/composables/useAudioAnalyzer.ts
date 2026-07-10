/**
 * 音频分析 composable（模块级单例）
 *
 * MusicControls 挂载时 connect(audioEl)，AudioVisualizer 在 rAF 中读取 getFrequencyData()。
 * AudioContext + AnalyserNode 由音频线程处理，主线程每帧只需调用一次 getByteFrequencyData。
 */
import { shallowRef, ref } from 'vue'

const audioEl = shallowRef<HTMLAudioElement | null>(null)
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let dataArray: Uint8Array | null = null

/** 是否有实际音频信号（供桌宠唱歌 / 魔法环等组件共享，避免重复轮询） */
const hasSignal = ref(false)
let signalCheckTimer: ReturnType<typeof setInterval> | null = null

function startSignalCheck() {
  if (signalCheckTimer) return
  signalCheckTimer = setInterval(() => {
    if (!analyser || !dataArray) return
    analyser.getByteFrequencyData(dataArray)
    hasSignal.value = dataArray.some((v) => v > 0)
  }, 250)
}

function stopSignalCheck() {
  if (signalCheckTimer) { clearInterval(signalCheckTimer); signalCheckTimer = null }
  hasSignal.value = false
}

export function useAudioAnalyzer() {
  function connect(el: HTMLAudioElement) {
    if (audioEl.value === el && audioContext && analyser) return

    disconnect()

    audioEl.value = el

    audioContext = new AudioContext()
    const source = audioContext.createMediaElementSource(el)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    dataArray = new Uint8Array(analyser.frequencyBinCount)

    source.connect(analyser)
    analyser.connect(audioContext.destination)
  }

  function disconnect() {
    stopSignalCheck()
    if (audioContext) {
      audioContext.close().catch(() => {})
      audioContext = null
    }
    analyser = null
    dataArray = null
    audioEl.value = null
  }

  function getFrequencyData(): Uint8Array {
    if (!analyser || !dataArray) return new Uint8Array(128)
    analyser.getByteFrequencyData(dataArray)
    return dataArray
  }

  async function resume() {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume()
    }
  }

  return { audioEl, connect, disconnect, getFrequencyData, resume, hasSignal, startSignalCheck, stopSignalCheck }
}
