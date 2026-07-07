<script setup lang="ts">
import {
  TooltipContent,
  TooltipPortal,
  type TooltipContentProps,
} from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<TooltipContentProps & { class?: string }>(),
  {
    sideOffset: 6,
  },
)
</script>

<template>
  <TooltipPortal>
    <TooltipContent
      v-bind="props"
      :class="
        cn(
          'z-50 overflow-hidden rounded-md bg-foreground/95 text-background px-3 py-1.5 text-xs shadow-pop data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=delayed-open]:zoom-in-95 backdrop-blur-sm',
          props.class,
        )
      "
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
