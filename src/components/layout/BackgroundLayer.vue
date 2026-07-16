<script setup lang="ts">
import MagicRings from './MagicRings.vue'

withDefaults(defineProps<{
  ringsOpacity?: number
  ringsSpeed?: number
  ringsBaseRadius?: number
}>(), {
  ringsOpacity: 0,
  ringsSpeed: 0.7,
  ringsBaseRadius: 0.18,
})
</script>

<template>
  <div class="absolute inset-0 -z-10 overflow-hidden">
    <!-- 底色微渐变 -->
    <div class="bg-base absolute inset-0" />
    <!-- 顶部柔光 -->
    <div class="bg-topglow absolute" />
    <!-- 网格 -->
    <div class="bg-grid absolute inset-0" />
    <!-- 右下角青蓝色模糊色块 -->
    <div class="bg-corner-glow absolute" />
    <!-- 魔法环（展开时） -->
    <Transition name="rings-fade">
      <MagicRings
        v-if="ringsOpacity > 0"
        color="#4bd7ff"
        color-two="#ffffff"
        :ring-count="4"
        :speed="ringsSpeed"
        :attenuation="10"
        :line-thickness="4"
        :base-radius="ringsBaseRadius"
        :radius-step="0.1"
        :scale-rate="0.1"
        :opacity="0.7"
        :blur="6"
        :noise-amount="0.1"
        :rotation="0"
        :ring-gap="2"
        :fade-in="0.7"
        :fade-out="0.5"
        :follow-mouse="false"
        :mouse-influence="0"
        :hover-scale="1.0"
        :parallax="0.05"
        :click-burst="false"
      />
    </Transition>
  </div>
</template>

<style scoped>
/* 底色：站点浅底上叠一层天蓝→薄荷的极淡渐变 */
.bg-base {
  background:
    radial-gradient(ellipse 100% 80% at 50% 0%, hsl(var(--color-sky) / 0.12) 0%, transparent 55%),
    linear-gradient(160deg, hsl(var(--color-sky) / 0.06) 0%, transparent 45%, hsl(var(--color-mint) / 0.07) 100%);
}
/* 顶部柔光 */
.bg-topglow {
  top: -20vh;
  left: 50%;
  width: 70vw;
  height: 50vh;
  transform: translateX(-50%);
  background: radial-gradient(ellipse at center, hsl(var(--color-sky) / 0.18), transparent 70%);
  filter: blur(30px);
  pointer-events: none;
}
/* 网格（淡线 + radial mask，调低调淡） */
.bg-grid {
  background-image:
    linear-gradient(hsl(var(--color-sky-soft) / 0.18) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--color-sky-soft) / 0.18) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse at center, black 18%, transparent 78%);
  mask-image: radial-gradient(ellipse at center, black 18%, transparent 78%);
  pointer-events: none;
}
/* 右下角青蓝色模糊色块（替代流光扫过） */
.bg-corner-glow {
  bottom: -15%;
  right: -10%;
  width: 50%;
  height: 40%;
  background: radial-gradient(ellipse at center, hsl(var(--color-sky) / 0.18), hsl(var(--color-mint) / 0.1) 50%, transparent 70%);
  filter: blur(60px);
  pointer-events: none;
}

.rings-fade-enter-active { transition: opacity 1.5s ease-out; }
.rings-fade-leave-active { transition: opacity 0.8s ease-in; }
.rings-fade-enter-from,
.rings-fade-leave-to { opacity: 0; }
</style>
