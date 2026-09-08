<script setup lang="ts">
import {onBeforeUnmount,ref,watch} from 'vue'
import {attachArticlePicker} from '@/lib/community-articles'
import '@/lib/community-articles.css'
const props=defineProps<{target:HTMLTextAreaElement|null}>()
const host=ref<HTMLElement|null>(null)
let cleanup:(()=>void)|undefined
watch([()=>props.target,host],([target,element])=>{cleanup?.();cleanup=target&&element?attachArticlePicker(target,element):undefined},{flush:'post'})
onBeforeUnmount(()=>cleanup?.())
</script>
<template><span ref="host" class="inline-flex min-w-0" /></template>
