<script setup lang="ts">
import { DialogTrigger, type DialogTriggerProps } from 'reka-ui'

const props = defineProps<DialogTriggerProps & { class?: string }>()
</script>

<template>
  <DialogTrigger v-bind="props" :class="props.class">
    <slot />
  </DialogTrigger>
</template>
