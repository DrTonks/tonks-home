<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <main class="min-h-dvh flex flex-col items-center justify-center gap-6 px-4">
    <div class="text-6xl font-mono text-brand-cyan">404</div>
    <p class="text-muted-foreground">页面未找到</p>
    <button
      class="px-4 py-2 rounded-md bg-brand-orange text-white hover:bg-brand-orange/80 transition-colors"
      @click="router.push('/')"
    >
      返回首页
    </button>
  </main>
</template>
