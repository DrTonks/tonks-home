/**
 * 桌宠介绍引导 — 首次见到桌宠时主动弹出特殊气泡，引导用户发现右键菜单。
 *
 * 流程：
 *  1. 挂载 3s 后 → 显示脉冲式 "💬" 引导气泡（不同于普通气泡）
 *  2. 用户点击引导气泡 → 播放介绍句序列（300-500ms 间隔）
 *  3. 介绍中宠物锁定默认状态（不可切表情/情绪）
 *  4. 播放完毕后标记 localStorage，不再重复
 */
import { ref, computed, onBeforeUnmount } from 'vue'
import type { SpeechBubbleApi } from './useSpeechBubble'

const STORAGE_PREFIX = 'pet-intro-seen-'

export function usePetIntro(
  petType: 'static' | 'live2d',
  bubble: SpeechBubbleApi,
  sentences: string[],
) {
  const storageKey = STORAGE_PREFIX + petType

  /** 'unseen' | 'prompting' | 'playing' | 'done' */
  const phase = ref<'unseen' | 'prompting' | 'playing' | 'done'>('unseen')
  /** 介绍过程中阻塞其他对话和状态切换 */
  const isActive = computed(() => phase.value === 'prompting' || phase.value === 'playing')
  /** 介绍过程中锁定宠物状态 */
  const introLocked = ref(false)

  let promptTimer: ReturnType<typeof setTimeout> | null = null
  let seqTimer: ReturnType<typeof setTimeout> | null = null

  function isSeen(): boolean {
    return localStorage.getItem(storageKey) === '1'
  }

  function markSeen() {
    localStorage.setItem(storageKey, '1')
  }

  /** 启动引导：3s 后未关闭则弹出提示气泡 */
  function start() {
    if (isSeen()) {
      phase.value = 'done'
      return
    }
    promptTimer = setTimeout(() => {
      if (phase.value !== 'unseen') return
      phase.value = 'prompting'
      // 使用 emoji 模式显示特殊提示
      bubble.say('💬 点我了解更多~', true)
    }, 3000)
  }

  /** 用户点击气泡后 → 播放介绍 */
  function handlePromptClick() {
    if (phase.value !== 'prompting') return false
    phase.value = 'playing'
    introLocked.value = true
    bubble.hide()
    playSequence(0)
    return true
  }

  /** 手动触发介绍（右键"关于桌宠"） */
  function triggerIntro() {
    if (phase.value === 'playing') return
    if (promptTimer) clearTimeout(promptTimer)
    phase.value = 'playing'
    introLocked.value = true
    bubble.hide()
    playSequence(0)
  }

  function playSequence(index: number) {
    if (index >= sentences.length) {
      phase.value = 'done'
      introLocked.value = false
      markSeen()
      return
    }
    bubble.say(sentences[index], true)
    seqTimer = setTimeout(() => {
      playSequence(index + 1)
    }, 300 + Math.random() * 200)
  }

  /** 是否正在提示阶段（用于展示特殊气泡样式） */
  const isPrompting = () => phase.value === 'prompting'
  const isPlaying = () => phase.value === 'playing'

  function cleanup() {
    if (promptTimer) clearTimeout(promptTimer)
    if (seqTimer) clearTimeout(seqTimer)
    // H4: 播放中途卸载也标记为 seen，防止下次挂载时重播
    if (phase.value === 'playing') markSeen()
  }

  onBeforeUnmount(cleanup)

  return { phase, introLocked, isPrompting, isPlaying, start, handlePromptClick, triggerIntro, cleanup }
}
