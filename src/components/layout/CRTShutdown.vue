<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ done: [] }>()

const phase = ref<'idle' | 'flash' | 'collapse' | 'black'>('idle')

watch(() => props.show, (v) => {
  if (!v) return
  phase.value = 'flash'
  setTimeout(() => { phase.value = 'collapse' }, 280)
  setTimeout(() => { phase.value = 'black' }, 550)
  setTimeout(() => emit('done'), 850)
})
</script>

<template>
  <div
    v-if="phase !== 'idle'"
    class="fixed inset-0 z-[10000] pointer-events-none bg-black"
  >
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-0.5 rounded-full"
      :class="phase"
    />
  </div>
</template>

<style scoped>
div.flash {
  background: #fff;
  animation: crt-flash 0.28s ease-out forwards;
}
div.collapse {
  background: #fff;
  animation: crt-collapse 0.27s ease-in forwards;
}
div.black {
  display: none;
}

@keyframes crt-flash {
  0%   { width: 0; opacity: 0; filter: brightness(1); }
  15%  { width: 70vw; opacity: 0.7; }
  35%  { width: 100vw; opacity: 1; filter: brightness(4); box-shadow: 0 0 40px 8px rgba(255,255,255,0.9); }
  70%  { width: 100vw; opacity: 0.9; filter: brightness(1.8); }
  100% { width: 50vw; opacity: 0.3; filter: brightness(0.6); }
}

@keyframes crt-collapse {
  0%   { width: 50vw; height: 4px; opacity: 0.8; filter: brightness(3); }
  30%  { width: 15vw; height: 2px; opacity: 0.5; }
  70%  { width: 3vw; height: 1px; opacity: 0.2; }
  100% { width: 0; height: 0; opacity: 0; }
}
</style>
