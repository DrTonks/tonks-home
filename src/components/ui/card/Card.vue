<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div
    :class="
      cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-card transition-all duration-normal ease-out-expo',
        props.class,
      )
    "
    :style="{
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
    }"
  >
    <slot />
  </div>
</template>
