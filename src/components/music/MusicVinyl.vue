<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Library } from 'lucide-vue-next'
import { useMusicStore } from '@/stores/music'
import { Card } from '@/components/ui/card'
import VinylDisc from './VinylDisc.vue'
import MusicLibraryDialog from './MusicLibraryDialog.vue'

const store = useMusicStore()
const showLibrary = ref(false)
const discSpinning = ref(false)
let spinDelayTimer: ReturnType<typeof setTimeout> | null = null

const coverUrl = computed(() =>
  store.currentSong?.hasCover
    ? `${store.getCoverUrl(store.currentSong.filename)}?v=${store.currentSong.coverVersion || 0}`
    : null,
)

onMounted(() => {
  store.fetchList()
})

watch(
  () => store.isPlaying,
  (playing) => {
    if (spinDelayTimer) {
      clearTimeout(spinDelayTimer)
      spinDelayTimer = null
    }
    if (!playing) {
      discSpinning.value = false
      return
    }
    spinDelayTimer = setTimeout(() => {
      discSpinning.value = true
      spinDelayTimer = null
    }, 600)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (spinDelayTimer) clearTimeout(spinDelayTimer)
})
</script>

<template>
  <Card
    class="interactive-card-outline vinyl-card flex w-[clamp(156px,12vw,180px)] cursor-pointer flex-col items-center justify-center overflow-visible p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    role="button"
    tabindex="0"
    aria-haspopup="dialog"
    :aria-expanded="showLibrary"
    aria-label="打开曲库"
    @click="showLibrary = true"
    @keydown.enter.prevent="showLibrary = true"
    @keydown.space.prevent="showLibrary = true"
  >
    <div class="vinyl-player relative h-[128px] w-[140px] cursor-pointer rounded-xl">
      <VinylDisc
        class="absolute left-0 top-2"
        :size="112"
        :spinning="discSpinning"
        :cover-url="coverUrl"
      />
      <svg class="tonearm" viewBox="0 0 140 128" aria-hidden="true">
        <circle cx="132" cy="55" r="9" class="tonearm-base" />
        <circle cx="132" cy="55" r="4.5" class="tonearm-pivot" />
        <g :class="['tonearm-moving', { playing: store.isPlaying }]">
          <path
            d="M 130 59 C 124 66, 116 74, 112 83 C 109 91, 108 99, 106 108"
            class="tonearm-shadow"
          />
          <path
            d="M 130 59 C 124 66, 116 74, 112 83 C 109 91, 108 99, 106 108"
            class="tonearm-arm"
          />
          <path d="M 102 104 L 111 106 L 109 119 L 99 117 Z" class="tonearm-head" />
        </g>
      </svg>
      <span class="vinyl-action-hint" aria-hidden="true">
        <Library class="h-3 w-3" />
        打开曲库
      </span>
    </div>

    <MusicLibraryDialog v-model:open="showLibrary" />
  </Card>
</template>

<style scoped>
.vinyl-player {
  isolation: isolate;
}

.vinyl-card,
.vinyl-card * {
  cursor: pointer;
}

.vinyl-action-hint {
  position: absolute;
  z-index: 4;
  right: -5px;
  top: 0px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid hsl(var(--color-sky-deep) / 0.22);
  border-radius: 999px;
  padding: 4px 7px;
  background: hsl(var(--background) / 0.9);
  color: hsl(var(--color-sky-deep));
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.12);
  font-size: 9px;
  white-space: nowrap;
  opacity: 0.5;
  transform: translateY(4px);
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.vinyl-card:hover .vinyl-action-hint,
.vinyl-card:focus-visible .vinyl-action-hint {
  opacity: 1;
  transform: translateY(1px);
}

.tonearm {
  position: absolute;
  z-index: 2;
  left: -3px;
  top: 3px;
  width: 140px;
  height: 128px;
  overflow: visible;
  pointer-events: none;
  filter: drop-shadow(1px 2px 2px rgb(0 0 0 / 0.28));
}

.tonearm-base {
  fill: hsl(var(--muted));
  stroke: rgb(80 80 86 / 0.38);
  stroke-width: 1.5;
}

.tonearm-pivot {
  fill: #f7f6f2;
  stroke: #d6d3cf;
  stroke-width: 2.5;
}

.tonearm-moving {
  transform-box: view-box;
  transform-origin: 132px 55px;
  transform: rotate(-4deg);
  transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tonearm-moving.playing {
  transform: rotate(25deg);
}

.tonearm-shadow,
.tonearm-arm {
  fill: none;
  stroke-linecap: round;
}

.tonearm-shadow {
  stroke: rgb(0 0 0 / 0.18);
  stroke-width: 7;
}

.tonearm-arm {
  stroke: #f7f6f2;
  stroke-width: 5;
}

.tonearm-head {
  fill: #f4f2ee;
  stroke: #d1ceca;
  stroke-width: 1;
}

@media (prefers-reduced-motion: reduce) {
  .tonearm-moving {
    transition: none;
  }
  .vinyl-action-hint {
    transition: none;
  }
}
</style>
