<script setup lang="ts">
import { ref, onMounted } from 'vue'

withDefaults(
  defineProps<{
    size?: number
  }>(),
  {
    size: 100,
  },
)

const emit = defineEmits<{ click: [] }>()

const jpgLoaded = ref(false)
const gifLoaded = ref(false)
const useGif = ref(false)
const loadFailed = ref(false)

onMounted(() => {
  // 先加载 jpg（占位）
  const jpg = new Image()
  jpg.src = '/assets/avatar.jpg'
  jpg.onload = () => {
    jpgLoaded.value = true
  }
  // 异步加载 gif，加载完替换
  const gif = new Image()
  gif.src = '/assets/avatar.gif'
  gif.onload = () => {
    gifLoaded.value = true
    useGif.value = true
  }
  gif.onerror = () => {
    loadFailed.value = true
  }
})
</script>

<template>
  <button
    class="relative rounded-full overflow-hidden shadow-2xl ring-4 ring-background/80 transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-label="点击展开主页"
    @click="emit('click')"
  >
    <!-- jpg 始终占据空间，gif 加载后叠加并淡入替换 -->
    <img
      v-show="jpgLoaded"
      src="/assets/avatar.jpg"
      alt="Tonks"
      class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none transition-opacity duration-500"
      :class="useGif ? 'opacity-0' : 'opacity-100'"
      draggable="false"
    />
    <img
      v-if="gifLoaded"
      src="/assets/avatar.gif"
      alt="Tonks"
      class="absolute inset-0 w-full h-full object-cover pointer-events-none select-none transition-opacity duration-500"
      :class="useGif ? 'opacity-100' : 'opacity-0'"
      draggable="false"
    />
    <!-- 加载占位 -->
    <div
      v-if="!jpgLoaded"
      class="absolute inset-0 bg-gradient-to-br from-primary/40 to-secondary/40 animate-pulse"
    />
    <!-- 装饰光环 -->
    <div
      class="absolute inset-0 rounded-full pointer-events-none ring-1 ring-primary/30 shadow-[0_0_24px_hsl(var(--primary)/0.3)]"
    />
  </button>
</template>
