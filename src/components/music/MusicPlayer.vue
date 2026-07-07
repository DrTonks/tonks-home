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
  Upload,
  Trash2,
  ListMusic,
  ChevronDown,
} from 'lucide-vue-next'
import { useMusicStore } from '@/stores/music'
import { useAdminStore } from '@/stores/admin'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { cn, formatTime } from '@/lib/utils'
import VinylDisc from './VinylDisc.vue'

const store = useMusicStore()
const admin = useAdminStore()

const audio = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const duration = ref(0)
const showList = ref(false)
const showUpload = ref(false)
const uploadTitle = ref('')
const uploadArtist = ref('')
const uploadFile = ref<File | null>(null)
const isUploading = ref(false)
const playError = ref(false)

const currentSrc = computed(() =>
  store.currentSong ? store.getStreamUrl(store.currentSong.filename) : '',
)

const progressPercent = computed(() =>
  duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0,
)

// 切歌：重置进度，按需自动播放
watch(
  () => store.currentSong?.filename,
  (newName, oldName) => {
    if (!newName) return
    if (newName === oldName) return
    currentTime.value = 0
    duration.value = 0
    playError.value = false
    // 等 DOM 更新 src 后再 load + play
    requestAnimationFrame(() => {
      if (audio.value) {
        audio.value.load()
        if (store.isPlaying) {
          audio.value.play().catch(() => {
            playError.value = true
            store.isPlaying = false
          })
        }
      }
    })
  },
)

// 播放/暂停同步
watch(
  () => store.isPlaying,
  (playing) => {
    if (!audio.value || !store.currentSong) return
    if (playing) {
      audio.value.play().catch(() => {
        playError.value = true
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

function pickFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.mp3,.wav,.ogg,.flac,.m4a,.aac'
  input.onchange = () => {
    if (input.files && input.files[0]) {
      uploadFile.value = input.files[0]
      if (!uploadTitle.value) {
        uploadTitle.value = input.files[0].name.replace(/\.[^.]+$/, '')
      }
    }
  }
  input.click()
}

async function doUpload() {
  if (!uploadFile.value) return
  isUploading.value = true
  try {
    await store.upload(uploadFile.value, uploadTitle.value, uploadArtist.value)
    showUpload.value = false
    uploadFile.value = null
    uploadTitle.value = ''
    uploadArtist.value = ''
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <Card class="w-[clamp(220px,18vw,280px)] p-4 relative">
    <!-- 标题 + 管理员按钮 -->
    <div class="flex items-center justify-between mb-3">
      <h2
        class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase"
      >
        music
      </h2>
      <div v-if="admin.isLoggedIn" class="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          class="h-7 w-7"
          aria-label="上传音乐"
          @click="showUpload = true"
        >
          <Upload class="h-3.5 w-3.5" />
        </Button>
        <Button
          v-if="store.currentSong"
          variant="ghost"
          size="icon-sm"
          class="h-7 w-7 hover:text-destructive"
          aria-label="删除当前歌曲"
          @click="store.remove(store.currentSong!.filename)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>

    <!-- 黑胶 -->
    <div class="flex justify-center mb-3">
      <VinylDisc :size="80" :spinning="store.isPlaying" />
    </div>

    <!-- 歌名 / 歌手 -->
    <div class="text-center min-h-[2.5em] flex flex-col justify-center mb-3">
      <p class="text-sm font-medium text-foreground line-clamp-1">
        {{ store.currentSong?.title || (store.isEmpty ? '暂无歌曲' : '未播放') }}
      </p>
      <p class="text-[11px] text-muted-foreground line-clamp-1">
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
      <div
        class="flex justify-between text-[10px] text-muted-foreground/70 tabular-nums"
      >
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

    <!-- 列表 -->
    <Transition name="list-expand">
      <div
        v-show="showList"
        class="mt-2 max-h-32 overflow-y-auto rounded-md bg-muted/30 border border-border/40"
      >
        <button
          v-for="(song, idx) in store.songs"
          :key="song.filename"
          class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-primary/10 transition-colors group"
          :class="idx === store.currentIndex ? 'bg-primary/15' : ''"
          @click="store.play(idx)"
        >
          <span
            class="w-4 text-[10px] tabular-nums text-muted-foreground shrink-0"
          >
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
          <span
            v-if="idx === store.currentIndex && store.isPlaying"
            class="text-primary shrink-0"
          >
            <span class="inline-block w-0.5 h-2.5 bg-primary animate-pulse rounded-full" />
          </span>
          <Trash2
            v-if="admin.isLoggedIn"
            class="h-3 w-3 text-muted-foreground/50 hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop="store.remove(song.filename)"
          />
        </button>
        <div
          v-if="store.isEmpty"
          class="px-2.5 py-3 text-center text-[11px] text-muted-foreground"
        >
          暂无歌曲
        </div>
      </div>
    </Transition>

    <!-- audio 元素 -->
    <audio
      ref="audio"
      :src="currentSrc"
      preload="metadata"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
    />

    <!-- 上传 Dialog -->
    <Dialog v-model:open="showUpload">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>上传音乐</DialogTitle>
          <DialogDescription>
            支持 mp3 / wav / ogg / flac / m4a / aac 格式
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <button
            class="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
            @click="pickFile"
          >
            <Upload class="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p class="text-sm text-foreground truncate">
              {{ uploadFile ? uploadFile.name : '点击选择文件' }}
            </p>
          </button>
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">标题</label>
            <input
              v-model="uploadTitle"
              type="text"
              class="w-full px-3 py-2 text-sm bg-background/60 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="歌曲标题"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">艺术家</label>
            <input
              v-model="uploadArtist"
              type="text"
              class="w-full px-3 py-2 text-sm bg-background/60 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              placeholder="歌手 / 艺术家"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose as-child>
            <Button variant="ghost">取消</Button>
          </DialogClose>
          <Button :disabled="!uploadFile || isUploading" @click="doUpload">
            {{ isUploading ? '上传中…' : '上传' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Card>
</template>

<style scoped>
.list-expand-enter-active,
.list-expand-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
  overflow: hidden;
}
.list-expand-enter-from,
.list-expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}
.list-expand-enter-to,
.list-expand-leave-from {
  opacity: 1;
  max-height: 8rem;
}
</style>
