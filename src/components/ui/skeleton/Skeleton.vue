<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div
    :class="
      cn('rounded-md bg-muted/60 animate-pulse pointer-events-none select-none', props.class)
    "
  />
</template>
