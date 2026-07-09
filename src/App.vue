<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import LoadingScreen from '@/components/layout/LoadingScreen.vue'

const route = useRoute()
const loading = ref(route.name !== 'not-found')
</script>

<template>
  <LoadingScreen v-if="loading" @done="loading = false" />
  <template v-else>
    <RouterView v-slot="{ Component }">
      <transition name="page-enter" appear>
        <component :is="Component" />
      </transition>
    </RouterView>
  </template>
</template>

<style scoped>
.page-enter-enter-active {
  transition: opacity 0.6s ease-out 0.1s;
}
.page-enter-leave-active {
  transition: opacity 0.3s ease-in;
}
.page-enter-enter-from {
  opacity: 0;
}
.page-enter-leave-to {
  opacity: 0;
}
</style>
