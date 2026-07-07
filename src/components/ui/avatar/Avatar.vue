<script setup lang="ts">
import { AvatarRoot, type AvatarRootProps, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<AvatarRootProps & { class?: string }>()
const forwarded = useForwardProps(props)
</script>

<template>
  <AvatarRoot
    v-bind="forwarded"
    :class="
      cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-border',
        props.class,
      )
    "
  >
    <slot />
  </AvatarRoot>
</template>
