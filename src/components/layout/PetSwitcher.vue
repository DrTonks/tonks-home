<script setup lang="ts">
/**
 * 桌宠切换编排器 — 单根节点修复 Transition 警告。
 */
import { ref, watch } from 'vue'
import { usePetEnvStore } from '@/stores/petEnv'
import DesktopPet from './DesktopPet.vue'
import Live2DPet from './Live2DPet.vue'
import LoadingBar from './LoadingBar.vue'

const emit = defineEmits<{ rage: []; rageStart: [] }>()

const petEnv = usePetEnvStore()
const desktopPetRef = ref<InstanceType<typeof DesktopPet> | null>(null)

const live2dEverMounted = ref(false)
const isLoadingLive2D = ref(false)
let loadingTimeout: ReturnType<typeof setTimeout> | null = null
const LOADING_TIMEOUT_MS = 15000

watch(
  () => petEnv.activePetType,
  (type) => {
    if (type === 'live2d' && !live2dEverMounted.value) {
      isLoadingLive2D.value = true
      live2dEverMounted.value = true
      loadingTimeout = setTimeout(() => {
        isLoadingLive2D.value = false
      }, LOADING_TIMEOUT_MS)
    }
  },
)

watch(() => petEnv.isLive2DReady, (ready) => {
  if (ready && isLoadingLive2D.value) {
    if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null }
    setTimeout(() => { isLoadingLive2D.value = false }, 600)
  }
})

watch(() => petEnv.isLive2DError, (err) => {
  if (err && isLoadingLive2D.value) {
    if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null }
    isLoadingLive2D.value = false
  }
})

function provoke() {
  if (petEnv.activePetType === 'static') desktopPetRef.value?.provoke()
}
defineExpose({ provoke })

function onRageStart() { emit('rageStart') }
function onRage() { emit('rage') }
</script>

<template>
  <!-- 单根节点：消除 Vue Transition 警告 -->
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

    <Teleport to="body">
      <div
        v-if="isLoadingLive2D"
        class="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
      >
        <LoadingBar :visible="true" />
      </div>
    </Teleport>
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
