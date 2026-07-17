<script setup lang="ts">
/**
 * 桌宠切换编排器
 * - DesktopPet 始终挂载，Live2DPet 首次切换时懒挂载
 * - Transition 动画控制入场/离场
 * - 暴怒期间禁止切换
 */
import { ref, watch } from 'vue'
import { usePetEnvStore } from '@/stores/petEnv'
import DesktopPet from './DesktopPet.vue'
import Live2DPet from './Live2DPet.vue'

const emit = defineEmits<{ rage: []; rageStart: [] }>()

const petEnv = usePetEnvStore()
const desktopPetRef = ref<InstanceType<typeof DesktopPet> | null>(null)
const live2DPetRef = ref<InstanceType<typeof Live2DPet> | null>(null)

const live2dEverMounted = ref(false)

watch(
  () => petEnv.activePetType,
  (type) => {
    if (type === 'live2d' && !live2dEverMounted.value) {
      live2dEverMounted.value = true
    }
  },
  { immediate: true },
)

function provoke() {
  if (petEnv.activePetType === 'static') {
    desktopPetRef.value?.provoke()
  } else {
    // Live2D 中指 → 切 angry 表情
    live2DPetRef.value?.provokeLive2D?.()
  }
}
/** 返回当前活跃桌宠的屏幕中心坐标，供手势切主题使用 */
function getPetCenter(): { x: number; y: number } {
  // B7: 改用 defineExpose 契约 getCenter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const center = (petEnv.activePetType === 'static' ? desktopPetRef.value : live2DPetRef.value) as any
  return center?.getCenter?.() ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}
defineExpose({ provoke, getPetCenter })

function onRageStart() { emit('rageStart') }
function onRage() { emit('rage') }
</script>

<template>
  <div>
    <Transition name="pet-fade">
      <DesktopPet
        v-if="petEnv.activePetType === 'static'"
        ref="desktopPetRef"
        @rage="onRage"
        @rage-start="onRageStart"
      />
    </Transition>

    <template v-if="live2dEverMounted">
      <Transition name="pet-fade">
        <Live2DPet ref="live2DPetRef" v-if="petEnv.activePetType === 'live2d'" />
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.pet-fade-enter-active {
  transition: opacity 0.35s ease-out, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.pet-fade-leave-active {
  transition: opacity 0.25s ease-in, transform 0.25s ease-in;
}
.pet-fade-enter-from {
  opacity: 0;
  transform: scale(0.3);
}
.pet-fade-leave-to {
  opacity: 0;
  transform: scale(0.3);
}
</style>
