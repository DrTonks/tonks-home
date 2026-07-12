<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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
  ChevronUp,
  Volume2,
  Volume1,
  VolumeX,
  Upload,
  Trash2,
} from 'lucide-vue-next'
import { useMusicStore } from '@/stores/music'
import { useAdminStore } from '@/stores/admin'
import { useAudioAnalyzer } from '@/composables/useAudioAnalyzer'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import MusicUploadDialog from './MusicUploadDialog.vue'
import { cn, formatTime } from '@/lib/utils'

const { isCompact } = withDefaults(defineProps<{ isCompact?: boolean }>(), { isCompact: false })
const store = useMusicStore()
const admin = useAdminStore()
const showUpload = ref(false) // 紧凑模式管理员上传弹窗

function onRemove() {
  if (store.currentSong) store.remove(store.currentSong.filename)
}

// 管理员排序：把第 idx 项上移(dir=-1)/下移(dir=1)一位，提交完整新顺序
function moveTrack(idx: number, dir: -1 | 1) {
  const to = idx + dir
  if (to < 0 || to >= store.songs.length) return
  const order = store.songs.map((s) => s.filename)
  ;[order[idx], order[to]] = [order[to], order[idx]]
  store.reorder(order)
}

const audio = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const showList = ref(false)

// 音量控制
const volume = ref(Number(localStorage.getItem('music_volume') ?? 0.7))
const isMuted = ref(false)

function setVolume(v: number) {
  volume.value = Math.min(1, Math.max(0, v))
  if (audio.value) audio.value.volume = volume.value
  localStorage.setItem('music_volume', String(volume.value))
  isMuted.value = volume.value === 0
}

const showVolume = ref(false)
const volumePopoverRef = ref<HTMLElement | null>(null)
const volumeBtnRef = ref<HTMLElement | null>(null)
const listPopoverRef = ref<HTMLElement | null>(null)
const listBtnRef = ref<HTMLElement | null>(null)

function toggleVolumePopover() {
  showVolume.value = !showVolume.value
}

function closeVolumePopover() {
  showVolume.value = false
}

function closeListPopover() {
  showList.value = false
}

// 点击弹窗外任意位置关闭
function onDocClick(e: MouseEvent) {
  const target = e.target as Node
  if (showVolume.value && !volumePopoverRef.value?.contains(target) && !volumeBtnRef.value?.contains(target)) {
    closeVolumePopover()
  }
  if (showList.value && !listPopoverRef.value?.contains(target) && !listBtnRef.value?.contains(target)) {
    closeListPopover()
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function volFromY(track: HTMLElement, clientY: number) {
  const rect = track.getBoundingClientRect()
  return 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
}

function onVolumeTrackClick(e: MouseEvent) {
  const track = e.currentTarget as HTMLElement
  setVolume(volFromY(track, e.clientY))
}

const isDragging = ref(false)
function onVolumeTrackMouseDown(e: MouseEvent) {
  isDragging.value = true
  const track = e.currentTarget as HTMLElement
  setVolume(volFromY(track, e.clientY))
  const handler = (ev: MouseEvent) => setVolume(volFromY(track, ev.clientY))
  const cleanup = () => {
    document.removeEventListener('mousemove', handler)
    document.removeEventListener('mouseup', cleanup)
    isDragging.value = false
  }
  document.addEventListener('mousemove', handler)
  document.addEventListener('mouseup', cleanup)
}

// 播放模式：列表循环(默认) → 随机 → 单曲循环 → 列表循环 …
type PlayMode = 'repeat-all' | 'shuffle' | 'repeat-one'
const playMode = computed<PlayMode>(() => {
  if (store.repeatMode === 'one') return 'repeat-one'
  if (store.shuffleMode === 'on') return 'shuffle'
  return 'repeat-all'
})
function cyclePlayMode() {
  if (playMode.value === 'repeat-all') {
    store.shuffleMode = 'on'
    store.repeatMode = 'off'
  } else if (playMode.value === 'shuffle') {
    store.shuffleMode = 'off'
    store.repeatMode = 'one'
  } else {
    store.shuffleMode = 'off'
    store.repeatMode = 'all'
  }
}

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
    store.currentTime = 0
    store.duration = 0
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
  if (audio.value) {
    currentTime.value = audio.value.currentTime
    store.currentTime = currentTime.value // 同步共享进度（供 LRC 歌词）
  }
}
function onLoadedMetadata() {
  if (audio.value) {
    duration.value = audio.value.duration
    store.duration = duration.value
  }
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

// 音频可视化：连接 AudioContext + 播放时自动恢复
const { connect, disconnect, resume: resumeCtx } = useAudioAnalyzer()
onMounted(() => {
  store.fetchList() // 音乐列表（MusicVinyl 在紧凑模式不挂载，必须在播放器里兜底）
  if (audio.value) {
    audio.value.volume = volume.value
    connect(audio.value)
  }
})
onBeforeUnmount(() => {
  disconnect()
  // 清理可能残留的音量拖拽监听器
  if (isDragging.value) {
    isDragging.value = false
  }
})
watch(() => store.isPlaying, (p) => { if (p) resumeCtx() })
</script>

<template>
  <Card class="w-[clamp(240px,18vw,320px)] p-4 !overflow-visible">
    <!-- 紧凑模式管理员按钮（MusicVinyl 不挂载时在此兜底） -->
    <div v-if="admin.isLoggedIn && isCompact" class="flex items-center gap-0.5 self-end -mt-1 -mr-1 mb-2 justify-end">
      <Button variant="ghost" size="icon-sm" class="h-6 w-6" aria-label="上传音乐" @click="showUpload = true">
        <Upload class="h-3 w-3" />
      </Button>
      <Button v-if="store.currentSong" variant="ghost" size="icon-sm" class="h-6 w-6 hover:text-destructive" aria-label="删除当前歌曲" @click="onRemove">
        <Trash2 class="h-3 w-3" />
      </Button>
    </div>
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

    <!-- 控制按钮 -->
    <div class="flex items-center justify-center gap-0.5 mb-3">
      <!-- 音量 -->
      <div ref="volumeBtnRef" class="relative">
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-8 w-8 transition-colors"
          :class="showVolume ? 'text-primary' : 'text-muted-foreground'"
          aria-label="音量"
          @click="toggleVolumePopover"
        >
          <VolumeX v-if="isMuted || volume === 0" class="h-3.5 w-3.5" />
          <Volume1 v-else-if="volume < 0.5" class="h-3.5 w-3.5" />
          <Volume2 v-else class="h-3.5 w-3.5" />
        </Button>
        <Transition name="volume-drop">
          <div
            v-if="showVolume"
            ref="volumePopoverRef"
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/95 dark:bg-popover backdrop-blur-md border border-white/40 dark:border-white/15 shadow-pop z-50"
            @click.stop
          >
            <span class="text-[10px] text-muted-foreground tabular-nums w-5 text-center">{{ Math.round(Number(volume) * 100) }}</span>
            <div
              class="relative w-2.5 h-24 rounded-full cursor-pointer"
              style="background: hsl(var(--muted-foreground) / 0.18)"
              @click.stop="onVolumeTrackClick"
              @mousedown.prevent="onVolumeTrackMouseDown"
            >
              <div
                class="absolute bottom-0 left-0 right-0 rounded-full"
                style="background: hsl(var(--primary))"
                :style="{ height: `${Number(volume) * 100}%`, transition: isDragging ? 'none' : 'height 0.15s ease-out' }"
              />
              <div
                class="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary shadow-sm"
                :style="{ bottom: `calc(${Number(volume) * 100}% - 6px)`, transition: isDragging ? 'none' : 'bottom 0.15s ease-out' }"
              />
            </div>
          </div>
        </Transition>
      </div>
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
      <!-- 播放模式：列表循环(默认) / 随机 / 单曲循环 -->
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-8 w-8 transition-colors"
        :class="playMode !== 'repeat-all' ? 'text-primary' : 'text-muted-foreground'"
        :aria-label="`播放模式: ${playMode === 'repeat-all' ? '列表循环' : playMode === 'shuffle' ? '随机' : '单曲循环'}`"
        @click="cyclePlayMode"
      >
        <Repeat v-if="playMode === 'repeat-all'" class="h-3.5 w-3.5" />
        <Shuffle v-else-if="playMode === 'shuffle'" class="h-3.5 w-3.5" />
        <Repeat1 v-else class="h-3.5 w-3.5" />
      </Button>
    </div>

    <!-- 列表展开按钮 -->
    <button
      ref="listBtnRef"
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
        ref="listPopoverRef"
        class="absolute left-3 right-3 top-full mt-2 max-h-36 overflow-y-auto rounded-md bg-white/95 dark:bg-popover backdrop-blur-md border border-white/30 dark:border-white/15 shadow-pop z-10 origin-top"
      >
        <div
          v-for="(song, idx) in store.songs"
          :key="song.filename"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-primary/10 transition-colors group cursor-pointer"
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
          <!-- 管理员排序：上移 / 下移 -->
          <div v-if="admin.isLoggedIn" class="flex flex-col shrink-0 -my-1">
            <button
              class="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
              :disabled="idx === 0"
              aria-label="上移"
              @click.stop="moveTrack(idx, -1)"
            >
              <ChevronUp class="h-3.5 w-3.5" />
            </button>
            <button
              class="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:pointer-events-none transition-colors"
              :disabled="idx === store.songs.length - 1"
              aria-label="下移"
              @click.stop="moveTrack(idx, 1)"
            >
              <ChevronDown class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
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
    <MusicUploadDialog v-model:open="showUpload" />
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

.volume-drop-enter-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.volume-drop-leave-active {
  transition: all 0.12s ease-in;
}
.volume-drop-enter-from {
  opacity: 0;
  transform: translate(-50%, 8px) scale(0.85);
}
.volume-drop-leave-to {
  opacity: 0;
  transform: translate(-50%, 4px) scale(0.9);
}
</style>
