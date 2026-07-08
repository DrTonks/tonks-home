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
    <div
      class="absolute inset-0 bg-gradient-to-br from-primary/25 via-primary/8 to-secondary/22 pointer-events-none"
    />
    <div class="absolute top-[5%] left-[6%] w-[38rem] h-[38rem] rounded-full bg-primary/32 blur-[110px] animate-float-soft pointer-events-none" style="animation-duration: 8s" />
    <div class="absolute top-[8%] right-[6%] w-[34rem] h-[34rem] rounded-full bg-secondary/30 blur-[110px] animate-float-soft pointer-events-none" style="animation-delay: -3s; animation-duration: 10s" />
    <div class="absolute bottom-[5%] left-[6%] w-[36rem] h-[36rem] rounded-full bg-secondary/28 blur-[110px] animate-float-soft pointer-events-none" style="animation-delay: -1.5s; animation-duration: 12s" />
    <div class="absolute bottom-[6%] right-[5%] w-[38rem] h-[38rem] rounded-full bg-primary/30 blur-[110px] animate-float-soft pointer-events-none" style="animation-delay: -4s; animation-duration: 9s" />
    <div class="absolute top-[35%] left-[40%] w-[30rem] h-[30rem] rounded-full bg-primary/20 blur-[100px] animate-float-soft pointer-events-none" style="animation-delay: -2s; animation-duration: 11s" />
    <div class="absolute top-[40%] right-[38%] w-[28rem] h-[28rem] rounded-full bg-secondary/22 blur-[100px] animate-float-soft pointer-events-none" style="animation-delay: -5s; animation-duration: 13s" />
    <div class="absolute top-[20%] left-[45%] w-[22rem] h-[22rem] rounded-full bg-brand-amber/15 blur-[90px] animate-float-soft pointer-events-none" style="animation-delay: -6s; animation-duration: 14s" />
    <div class="absolute bottom-[20%] left-[45%] w-[20rem] h-[20rem] rounded-full bg-brand-mint-soft/20 blur-[80px] animate-float-soft pointer-events-none" style="animation-delay: -7s; animation-duration: 15s" />
    <div
      class="absolute inset-0 opacity-45 pointer-events-none"
      style="
        background-image:
          linear-gradient(hsl(var(--color-sky-soft) / 0.30) 1px, transparent 1px),
          linear-gradient(90deg, hsl(var(--color-sky-soft) / 0.30) 1px, transparent 1px);
        background-size: 56px 56px;
        mask-image: radial-gradient(ellipse at center, black 28%, transparent 80%);
        -webkit-mask-image: radial-gradient(ellipse at center, black 28%, transparent 80%);
      "
    />
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
        :opacity="0.6"
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
.rings-fade-enter-active {
  transition: opacity 1.5s ease-out;
}
.rings-fade-leave-active {
  transition: opacity 0.8s ease-in;
}
.rings-fade-enter-from,
.rings-fade-leave-to {
  opacity: 0;
}
</style>
