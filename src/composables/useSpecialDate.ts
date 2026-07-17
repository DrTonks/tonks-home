/**
 * 特殊日期检测 — 检查生日等特殊日期并在当天触发庆祝。
 */
import { ref } from 'vue'
import { usePetMemory } from './usePetMemory'
import type { SpeechBubbleApi } from '@/components/layout/pet/useSpeechBubble'

export function useSpecialDate() {
  const memory = usePetMemory()
  const isCelebrating = ref(false)

  /**
   * 检查今天是否为特殊日期（目前仅生日）。
   * @param bubble 可选的气泡 API，传入则自动说出祝福语
   * @param message 自定义祝福文案（默认 "生日快乐。"）
   * @returns 是否为特殊日期
   */
  function checkToday(bubble?: SpeechBubbleApi, message = '生日快乐。'): boolean {
    // 幂等守卫：同一天不重复触发
    if (isCelebrating.value) return true
    if (memory.isBirthdayToday()) {
      isCelebrating.value = true
      if (bubble) {
        bubble.say(message, true)
      }
      return true
    }
    return false
  }

  return { isCelebrating, checkToday }
}
