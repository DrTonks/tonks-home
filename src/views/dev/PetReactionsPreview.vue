<script setup lang="ts">
// Development-only gallery: real shared speech renderer, no AI requests or saved memories.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import SpeechBubble from '@/components/layout/pet/SpeechBubble.vue'
import { useSpeechBubble } from '@/components/layout/pet/useSpeechBubble'
import { usePetReactions } from '@/composables/usePetReactions'
import { findReaction, petReactions, type PetPersona } from '@/lib/petReactions'
const pet = ref<PetPersona>('static')
const selected = ref('quiet_happy')
const bubble = useSpeechBubble()
const choices = computed(() => petReactions.filter(r => r.pets.includes(pet.value)))
const reactions = { static: usePetReactions('static', bubble), live2d: usePetReactions('live2d', bubble) }
const text = ref('谢谢，收到你的推荐了。今天又多了一点值得期待的事。')
function preview(imageOnly = false) {
  bubble.sayReply({ text: imageOnly ? '' : text.value, image: findReaction(pet.value, selected.value) }, true, true)
}
watch(pet, () => { selected.value = choices.value[0]!.id; bubble.hide() })
onBeforeUnmount(bubble.hide)
</script>
<template>
  <main class="preview">
    <h1>桌宠表情预览</h1>
    <p>本地验收页 · 共用实际气泡组件，不请求 AI，也不记录用户记忆。</p>
    <div class="controls">
      <label>角色 <select v-model="pet"><option value="static">普瑞赛斯</option><option value="live2d">U 酱</option></select></label>
      <label>回复文字 <input v-model="text" /></label>
      <button @click="preview()">预览图文回复</button>
      <button @click="preview(true)">预览纯表情</button>
      <button @click="reactions[pet].sayLocal('happy', pet === 'static' ? '很高兴见到你。' : '好耶，老板！', true)">本地开心互动（实际概率）</button>
      <button @click="bubble.showLyric('星星落在你的眼睛里')">切换到歌词</button>
      <button @click="bubble.sayReply({text: text, image:{src:'/emojis/v1/test/missing.jpg',label:'测试坏图'}},true,true)">测试图片失败</button>
    </div>
    <div class="stage">
      <div class="character">
        <img :src="pet === 'static' ? '/assets/pet/happy.png' : '/assets/live2d/ug/icon.png'" :alt="pet === 'static' ? '普瑞赛斯' : 'U 酱'" />
        <SpeechBubble :visible="bubble.visible.value" :mode="bubble.mode.value" :text="bubble.text.value"
          :emoji="bubble.emoji.value" :emoji-label="bubble.emojiLabel.value" :original="bubble.original.value"
          placement="left" :vertical-offset="0" :horizontal-offset="0" />
      </div>
    </div>
    <div class="gallery">
      <button v-for="item in choices" :key="item.id" :aria-pressed="selected === item.id"
        @click="selected = item.id; preview()">
        <img :src="item.src" :alt="item.label" /><b>{{ item.id }}</b><span>{{ item.label }}</span>
      </button>
    </div>
  </main>
</template>
<style scoped>
.preview { max-width: 1100px; margin: 0 auto; padding: 32px 20px; color: hsl(var(--foreground)); }
h1 { font-size: 26px; font-weight: 700; } p { margin: 10px 0 20px; color: hsl(var(--muted-foreground)); }
.controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.controls label { display: flex; align-items: center; gap: 8px; }
button, input, select { border: 1px solid hsl(var(--border)); background: hsl(var(--background)); border-radius: 8px; padding: 8px 12px; }
input { width: min(360px, 65vw); }
.stage { height: 240px; display: flex; align-items: center; justify-content: flex-end; padding-right: 20%; margin-top: 24px; }
.character { position: relative; width: 90px; } .character > img { width: 90px; max-height: 135px; object-fit: contain; }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px,1fr)); gap: 14px; }
.gallery button { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.gallery button[aria-pressed=true] { border-color: hsl(var(--primary)); }
.gallery img { width: 85px; height: 85px; object-fit: contain; }
.gallery b { font: 11px ui-monospace, monospace; } .gallery span { font-size: 12px; }
@media(max-width:600px) { .stage { padding-right: 0; } }
</style>
