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
  if (petEnv.activePetType === 'static') desktopPetRef.value?.provoke()
}
defineExpose({ provoke })

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
        <Live2DPet v-if="petEnv.activePetType === 'live2d'" />
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
