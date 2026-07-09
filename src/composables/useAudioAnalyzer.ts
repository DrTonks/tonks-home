/**
 * 音频分析 composable（模块级单例）
 *
 * MusicControls 挂载时 connect(audioEl)，AudioVisualizer 在 rAF 中读取 getFrequencyData()。
 * AudioContext + AnalyserNode 由音频线程处理，主线程每帧只需调用一次 getByteFrequencyData。
 */
import { shallowRef } from 'vue'

const audioEl = shallowRef<HTMLAudioElement | null>(null)
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let dataArray: Uint8Array | null = null

export function useAudioAnalyzer() {
  function connect(el: HTMLAudioElement) {
    // 避免重复连接同一个元素
    if (audioEl.value === el && audioContext && analyser) return

    // 清理旧连接
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

  /**
   * 确保 AudioContext 处于运行状态（浏览器自动暂停策略）
   */
  async function resume() {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume()
    }
  }

  return { audioEl, connect, disconnect, getFrequencyData, resume }
}
