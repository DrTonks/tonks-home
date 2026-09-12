<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ src: string; name?: string }>()
const stage = ref(0)
watch(() => props.src, () => { stage.value = 0 })
const source = computed(() => {
  if (!stage.value) return props.src
  const url = new URL(props.src, window.location.origin)
  url.searchParams.set('fallback', String(stage.value))
  return url.href
})
</script>

<template>
  <img v-if="stage < 3" :src="source" alt="" draggable="false" referrerpolicy="no-referrer"
    @error="stage = Math.min(stage + 1, 3)" />
  <span v-else>{{ name?.trim().slice(0, 2).toUpperCase() || '访客' }}</span>
</template>

<style scoped>
img { width: 100%; height: 100%; object-fit: cover; }
</style>
