<script setup lang="ts">
import { TabsList, type TabsListProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TabsListProps & { class?: string }>()
</script>

<template>
  <TabsList
    v-bind="props"
    :class="
      cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted/40 dark:bg-white/[0.1] p-1 text-muted-foreground backdrop-blur-sm',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
