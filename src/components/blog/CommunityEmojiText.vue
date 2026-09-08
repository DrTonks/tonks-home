<script setup lang="ts">
import {onBeforeUnmount,onMounted,ref,watchEffect} from 'vue'
import {loadEmojiManifest,subscribeEmojis} from '@/lib/community-emojis'
import {renderCommunityMarkdown} from '@/lib/community-markdown'
import '@/lib/community-markdown.css'
const props=withDefaults(defineProps<{text:string;compact?:boolean}>(),{compact:true})
const host=ref<HTMLElement|null>(null),revision=ref(0)
const stop=subscribeEmojis(()=>revision.value++)
onBeforeUnmount(stop)
onMounted(()=>void loadEmojiManifest())
watchEffect(()=>{void revision.value;if(host.value)renderCommunityMarkdown(host.value,props.text,props.compact)},{flush:'post'})
</script>
<template><div ref="host" /></template>
