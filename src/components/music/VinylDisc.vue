<script setup lang="ts">
import { Music as MusicIcon } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    size?: number
    spinning?: boolean
    coverUrl?: string | null
  }>(),
  {
    size: 80,
    spinning: false,
    coverUrl: null,
  },
)
</script>

<template>
  <div class="vinyl-frame relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
    <div
      class="vinyl-disc absolute inset-[2px] overflow-hidden rounded-full motion-reduce:animate-none"
      :style="{ animationPlayState: spinning ? 'running' : 'paused' }"
    >
      <div class="vinyl-grooves absolute inset-0 rounded-full" aria-hidden="true" />
      <div class="vinyl-rim absolute inset-[1px] rounded-full" aria-hidden="true" />

      <div class="vinyl-label absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full">
        <img
          v-if="coverUrl"
          :src="coverUrl"
          alt=""
          class="absolute inset-0 h-full w-full object-cover"
          draggable="false"
        />
        <template v-else>
          <div class="absolute inset-0 bg-primary dark:bg-[#b53a31]" />
          <div class="absolute inset-[13%] rounded-full border border-white/25" />
          <MusicIcon
            class="relative text-primary-foreground dark:text-white"
            :style="{ width: `${size * 0.16}px`, height: `${size * 0.16}px` }"
          />
        </template>
        <span class="vinyl-spindle absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>
    </div>
    <!-- 光源固定在页面空间中，不随唱片本体旋转。 -->
    <div class="vinyl-sheen pointer-events-none absolute inset-[2px] rounded-full" aria-hidden="true" />
  </div>
</template>

<style scoped>
.vinyl-frame {
  filter: drop-shadow(0 5px 7px rgb(0 0 0 / 0.28));
}

.vinyl-disc {
  background:
    radial-gradient(circle at center, transparent 0 31%, rgb(0 0 0 / 0.14) 31.5% 32%, transparent 32.5%),
    radial-gradient(circle at center, #242424 0%, #151515 46%, #090909 77%, #020202 100%);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.06),
    inset 0 0 18px rgb(0 0 0 / 0.4);
  animation: vinyl-spin 8s linear infinite;
}

.vinyl-grooves {
  background: repeating-radial-gradient(
    circle at center,
    transparent 0 3px,
    rgb(255 255 255 / 0.045) 3.6px 4.2px,
    rgb(0 0 0 / 0.2) 4.7px 5.4px
  );
  mask: radial-gradient(circle, transparent 0 31%, #000 32% 97%, transparent 98%);
}

.vinyl-sheen {
  z-index: 1;
  background:
    conic-gradient(from 205deg, transparent 0 7%, rgb(255 255 255 / 0.12) 12%, transparent 20% 47%, rgb(255 255 255 / 0.06) 54%, transparent 63%),
    linear-gradient(128deg, transparent 18%, rgb(255 255 255 / 0.08) 37%, transparent 53%);
  filter: blur(0.3px);
  opacity: 0.8;
  mask: radial-gradient(circle, transparent 0 31%, #000 33% 96%, transparent 98%);
  box-shadow:
    inset -8px -10px 18px rgb(0 0 0 / 0.42),
    inset 7px 6px 12px rgb(255 255 255 / 0.04);
}

.vinyl-rim {
  border: 1px solid rgb(255 255 255 / 0.08);
  box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.36);
}

.vinyl-label {
  width: 59%;
  height: 59%;
  background: hsl(var(--primary));
  box-shadow:
    0 0 0 2px rgb(0 0 0 / 0.44),
    inset 0 0 9px rgb(0 0 0 / 0.16);
}

.vinyl-spindle {
  background: #e9e7e2;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 0.2), 0 1px 2px rgb(0 0 0 / 0.45);
}

@keyframes vinyl-spin {
  to { transform: rotate(360deg); }
}
</style>
