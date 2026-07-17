/**
 * 共享环境状态 — 两个桌宠通过它感知环境事件（音乐/暴怒/切换中）。
 * DesktopPet 写入 isRageActive，PetSwitcher 写入 activePetType，
 * Live2DPet 挂载时读取 isMusicPlaying 决定是否进唱歌模式。
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useMusicStore } from '@/stores/music'

export type PetType = 'static' | 'live2d'

export const usePetEnvStore = defineStore('petEnv', () => {
  const activePetType = ref<PetType>('static')
  const isRageActive = ref(false)
  /** 主页折叠中（桌面宠根元素淡出） */
  const isCollapsing = ref(false)
  /** Live2D 模型是否已加载完成（Live2DPet 写入，PetSwitcher 读取） */
  const isLive2DReady = ref(false)
  /** Live2D 加载是否出错（useLive2DModel 写入，PetSwitcher 读取以关闭 loading） */
  const isLive2DError = ref(false)
  /** 提问气泡是否激活（两个桌宠通过它做气泡互斥） */
  const isQuestionActive = ref(false)

  const musicStore = useMusicStore()
  const isMusicPlaying = computed(() => musicStore.isPlaying)

  /** 检查是否允许切换（暴怒中拒绝） */
  function canSwitch(): boolean {
    return !isRageActive.value
  }

  return {
    activePetType,
    isRageActive,
    isCollapsing,
    isLive2DReady,
    isLive2DError,
    isQuestionActive,
    isMusicPlaying,
    canSwitch,
  }
})
