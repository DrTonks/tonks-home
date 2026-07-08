<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  ChevronDown,
} from 'lucide-vue-next'
import { useMusicStore } from '@/stores/music'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn, formatTime } from '@/lib/utils'

const store = useMusicStore()

const audio = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const showList = ref(false)

const currentSrc = computed(() =>
  store.currentSong ? store.getStreamUrl(store.currentSong.filename) : '',
)
const progressPercent = computed(() =>
  duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0,
)

watch(
  () => store.currentSong?.filename,
  (newName, oldName) => {
    if (!newName || newName === oldName) return
    currentTime.value = 0
    duration.value = 0
    requestAnimationFrame(() => {
      if (audio.value) {
        audio.value.load()
        if (store.isPlaying) {
          audio.value.play().catch(() => {
            store.isPlaying = false
          })
        }
      }
    })
  },
)

watch(
  () => store.isPlaying,
  (playing) => {
    if (!audio.value || !store.currentSong) return
    if (playing) {
      audio.value.play().catch(() => {
        store.isPlaying = false
      })
    } else {
      audio.value.pause()
    }
  },
)

function onTimeUpdate() {
  if (audio.value) currentTime.value = audio.value.currentTime
}
function onLoadedMetadata() {
  if (audio.value) duration.value = audio.value.duration
}
function onEnded() {
  if (store.repeatMode === 'one') {
    if (audio.value) {
      audio.value.currentTime = 0
      audio.value.play()
    }
  } else if (
    store.repeatMode === 'all' ||
    store.currentIndex < store.songs.length - 1 ||
    store.shuffleMode === 'on'
  ) {
    store.next()
  } else {
    store.isPlaying = false
  }
}

function seek(e: Event) {
  const target = e.target as HTMLInputElement
  const value = Number(target.value)
  if (audio.value && isFinite(value)) {
    audio.value.currentTime = value
    currentTime.value = value
  }
}
</script>

<template>
  <Card class="w-[clamp(240px,18vw,320px)] p-4 !overflow-visible">
    <!-- 歌名（花体）/ 歌手 -->
    <div class="text-center mb-3 min-h-[2.5em] flex flex-col justify-center">
      <p class="font-script text-xl font-semibold text-brand-sky-deep line-clamp-1">
        {{ store.currentSong?.title || (store.isEmpty ? '暂无歌曲' : '未播放') }}
      </p>
      <p class="font-heavy text-[11px] text-brand-mint-deep tracking-wider line-clamp-1">
        {{ store.currentSong?.artist || '—' }}
      </p>
    </div>

    <!-- 进度条 -->
    <div class="space-y-1 mb-3">
      <input
        type="range"
        min="0"
        :max="duration || 0"
        :value="currentTime"
        step="0.1"
        class="w-full h-1 appearance-none rounded-full cursor-pointer
               [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
               [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
               [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform
               [&::-webkit-slider-thumb]:hover:scale-110
               [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full
               [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
        :style="{
          background: `linear-gradient(to right, hsl(var(--primary)) ${progressPercent}%, hsl(var(--muted-foreground) / 0.25) ${progressPercent}%)`,
        }"
        @input="seek"
      />
      <div class="flex justify-between text-[10px] text-muted-foreground/70 tabular-nums">
        <span>{{ formatTime(currentTime) }}</span>
        <span>{{ formatTime(duration) }}</span>
      </div>
    </div>

    <!-- 5 按钮控制 -->
    <div class="flex items-center justify-center gap-0.5 mb-3">
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-8 w-8 transition-colors"
        :class="store.shuffleMode === 'on' ? 'text-primary' : 'text-muted-foreground'"
        aria-label="随机播放"
        @click="store.toggleShuffle()"
      >
        <Shuffle class="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-8 w-8"
        aria-label="上一首"
        :disabled="store.isEmpty"
        @click="store.prev()"
      >
        <SkipBack class="h-4 w-4" />
      </Button>
      <Button
        variant="default"
        size="icon"
        class="h-9 w-9 rounded-full shadow-md"
        aria-label="播放/暂停"
        :disabled="store.isEmpty"
        @click="store.togglePlay()"
      >
        <Play v-if="!store.isPlaying" class="h-4 w-4 translate-x-0.5" />
        <Pause v-else class="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-8 w-8"
        aria-label="下一首"
        :disabled="store.isEmpty"
        @click="store.next()"
      >
        <SkipForward class="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-8 w-8 transition-colors"
        :class="store.repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'"
        aria-label="循环模式"
        @click="store.cycleRepeat()"
      >
        <Repeat v-if="store.repeatMode !== 'one'" class="h-3.5 w-3.5" />
        <Repeat1 v-else class="h-3.5 w-3.5" />
      </Button>
    </div>

    <!-- 列表展开按钮 -->
    <button
      class="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
      @click="showList = !showList"
    >
      <ListMusic class="h-3 w-3" />
      <span>列表 {{ store.songs.length }} 首</span>
      <ChevronDown
        :class="cn('h-3 w-3 transition-transform', showList && 'rotate-180')"
      />
    </button>

    <!-- 列表（absolute 浮层 + scale 弹出动画） -->
    <Transition name="list-drop">
      <div
        v-show="showList"
        class="absolute left-3 right-3 top-full mt-2 max-h-36 overflow-y-auto rounded-md bg-white/95 backdrop-blur-md border border-white/30 shadow-pop z-10 origin-top"
      >
        <button
          v-for="(song, idx) in store.songs"
          :key="song.filename"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-primary/10 transition-colors group"
          :class="idx === store.currentIndex ? 'bg-primary/15' : ''"
          @click="store.play(idx)"
        >
          <span class="w-4 text-[10px] tabular-nums text-muted-foreground shrink-0">
            {{ (idx + 1).toString().padStart(2, '0') }}
          </span>
          <div class="flex-1 min-w-0">
            <p
              class="text-xs font-medium line-clamp-1"
              :class="idx === store.currentIndex ? 'text-primary' : 'text-foreground'"
            >
              {{ song.title }}
            </p>
            <p class="text-[10px] text-muted-foreground line-clamp-1">
              {{ song.artist }}
            </p>
          </div>
        </button>
        <div
          v-if="store.isEmpty"
          class="px-2.5 py-3 text-center text-[11px] text-muted-foreground"
        >
          暂无歌曲
        </div>
      </div>
    </Transition>

    <audio
      ref="audio"
      :src="currentSrc"
      preload="none"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
      @error="() => { store.isPlaying = false }"
    />
  </Card>
</template>

<style scoped>
.list-drop-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-drop-leave-active {
  transition: all 0.15s ease-in;
}
.list-drop-enter-from {
  opacity: 0;
  transform: scaleY(0.7) translateY(-8px);
}
.list-drop-leave-to {
  opacity: 0;
  transform: scaleY(0.8) translateY(-4px);
}
</style>
