<script setup lang="ts">
import {nextTick,onBeforeUnmount,ref} from 'vue'
import CommunityEmojiPicker from './CommunityEmojiPicker.vue'
const model=defineModel<string>({required:true})
const props=defineProps<{target:HTMLTextAreaElement|null}>()
const open=ref(false),host=ref<HTMLElement|null>(null)
function close(){open.value=false;props.target?.focus()}
function choose(value:string){const input=props.target;const start=input?.selectionStart??model.value.length;const end=input?.selectionEnd??start;const next=model.value.slice(0,start)+value+model.value.slice(end);if(next.length>800)return;model.value=next;open.value=false;void nextTick(()=>{input?.focus();input?.setSelectionRange(start+value.length,start+value.length)})}
function outside(e:PointerEvent){if(e.target instanceof Node&&!host.value?.contains(e.target))open.value=false}
document.addEventListener('pointerdown',outside)
onBeforeUnmount(()=>document.removeEventListener('pointerdown',outside))
</script>
<template><span ref="host" class="relative inline-flex"><button type="button" class="rounded px-2 py-1 text-lg hover:bg-muted" aria-label="选择表情" :aria-expanded="open" @click="open=!open">☺</button><CommunityEmojiPicker v-if="open" :anchor="host" @select="choose" @close="close"/></span></template>
