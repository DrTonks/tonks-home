<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {getEmojiGroups,loadEmojiManifest,subscribeEmojis,recentEmojis,rememberEmoji,type EmojiItem} from '@/lib/community-emojis'
import {activateCommunityPicker,communityOverlayHost,communityOverlayPosition} from '@/lib/community-overlay'
const emit=defineEmits<{select:[value:string];close:[]}>()
const props=defineProps<{anchor:HTMLElement|null}>()
const panel=ref<HTMLElement|null>(null)
const positionStyle=ref<Record<string,string>>({visibility:'hidden'})
function position(){
  if(!props.anchor || !panel.value) return
  positionStyle.value=communityOverlayPosition(props.anchor,350)
}
const revision=ref(0), selected=ref('laopu'), query=ref('')
const searchInput=ref<HTMLInputElement|null>(null)
const limit=ref(80)
watch([selected,query],()=>limit.value=80)
const stop=subscribeEmojis(()=>revision.value++)
onBeforeUnmount(stop)
let releasePicker=()=>{}
onMounted(async()=>{releasePicker=activateCommunityPicker(()=>emit('close'));void loadEmojiManifest();position();window.addEventListener('resize',position);document.addEventListener('scroll',position,true);await nextTick();searchInput.value?.focus()})
onBeforeUnmount(()=>{releasePicker();window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true)})
watch(()=>props.anchor,position,{flush:'post'})
const groups=computed(()=>{void revision.value;return [{id:'recent',label:'最近',items:recentEmojis()},...getEmojiGroups()]})
const items=computed(()=>{
  const q=query.value.trim().toLowerCase()
  return q?groups.value.filter(g=>g.id!=='recent').flatMap(g=>g.items.filter(e=>`${g.label} ${e.label}`.toLowerCase().includes(q))):groups.value.find(g=>g.id===selected.value)?.items||[]
})
function choose(item:EmojiItem){rememberEmoji(item);emit('select',item.text??item.token)}
</script>
<template>
  <Teleport :to="communityOverlayHost(anchor)"><section ref="panel" :style="positionStyle" class="community-emoji-picker" aria-label="表情面板" @pointerdown.stop @keydown.esc.stop.prevent="emit('close')">
    <div class="emoji-search"><input ref="searchInput" v-model="query" aria-label="搜索表情" placeholder="搜索表情"/><button type="button" aria-label="关闭表情面板" @click="emit('close')">×</button></div>
    <div class="emoji-tabs" aria-label="表情分组"><button v-for="group in groups" :key="group.id" type="button" :aria-pressed="selected===group.id && !query" @click="selected=group.id;query=''">{{group.label}}</button></div>
    <div class="emoji-grid">
      <button v-for="item in items.slice(0,limit)" :key="item.token" type="button" :title="item.label" :aria-label="item.label" @click="choose(item)">
        <img v-if="item.src" :src="item.src" :alt="item.label" loading="lazy" width="44" height="44" draggable="false"/>
        <span v-else>{{item.text}}</span>
      </button>
      <p v-if="!items.length">{{query?'没有找到表情':'还没有使用记录'}}</p>
      <button v-if="items.length>limit" type="button" class="emoji-more" @click="limit+=80">加载更多（{{items.length-limit}}）</button>
    </div>
  </section></Teleport>
</template>
<style scoped>
.community-emoji-picker{position:fixed;z-index:10000;box-sizing:border-box;overflow-y:auto;padding:10px;border:1px solid hsl(var(--border));border-radius:12px;background:hsl(var(--background));color:hsl(var(--foreground));box-shadow:0 8px 30px #0002}
.emoji-search{display:flex;gap:8px}.emoji-search input{width:100%;min-width:0;background:hsl(var(--muted));border-radius:6px;padding:6px 9px;font-size:12px;outline-offset:2px}.emoji-search button{width:24px}
.emoji-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}.emoji-tabs button{padding:4px 7px;border-radius:5px;font-size:11px}.emoji-tabs button[aria-pressed=true]{background:hsl(var(--primary)/.14);color:hsl(var(--primary))}
.emoji-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;max-height:220px;overflow-y:auto;overscroll-behavior:contain}
.emoji-grid button{min-height:52px;display:grid;place-items:center;border-radius:6px;overflow:hidden;font-size:20px}.emoji-grid button:hover{background:hsl(var(--muted))}.emoji-grid img{width:44px;height:44px;object-fit:contain}.emoji-grid span{font-size:16px;overflow-wrap:anywhere}.emoji-grid p{grid-column:1/-1;font-size:12px;text-align:center;padding:20px}
button:focus-visible{outline:2px solid hsl(var(--ring));outline-offset:-2px}
.emoji-grid .emoji-more{grid-column:1/-1;min-height:32px;font-size:12px}
</style>
