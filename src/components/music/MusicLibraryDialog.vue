<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ChevronUp, Disc3, ImagePlus, LoaderCircle, Trash2, Upload } from 'lucide-vue-next'
import { useMusicStore } from '@/stores/music'
import { useAdminStore } from '@/stores/admin'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import MusicUploadDialog from './MusicUploadDialog.vue'

const open = defineModel<boolean>('open')
const store = useMusicStore()
const admin = useAdminStore()
const showUpload = ref(false)
const coverUploadingFor = ref<string | null>(null)
const pendingDelete = ref<string | null>(null)
const deleting = ref<string | null>(null)
const error = ref('')

function selectSong(filename: string) {
  const song = store.songs.find((item) => item.filename === filename)
  if (!song) return
  store.playSong(song)
  open.value = false
}

function moveTrack(idx: number, dir: -1 | 1) {
  const to = idx + dir
  if (to < 0 || to >= store.songs.length) return
  const order = store.songs.map((song) => song.filename)
  ;[order[idx], order[to]] = [order[to], order[idx]]
  void store.reorder(order)
}

function pickCover(filename: string) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      error.value = '封面图片不能超过 5MB'
      return
    }
    coverUploadingFor.value = filename
    error.value = ''
    try {
      await store.uploadCover(filename, file)
    } catch (cause) {
      console.warn('[music] cover upload failed', cause)
      error.value = '封面上传失败，请确认管理员登录状态后重试'
    } finally {
      coverUploadingFor.value = null
    }
  }
  input.click()
}

async function confirmDelete(filename: string) {
  deleting.value = filename
  error.value = ''
  try {
    await store.remove(filename)
    pendingDelete.value = null
  } catch (cause) {
    console.warn('[music] delete failed', cause)
    error.value = '歌曲删除失败，请稍后重试'
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] max-w-2xl overflow-hidden p-0">
      <DialogHeader class="border-b border-border px-6 pb-4 pt-6">
        <DialogTitle class="flex items-center gap-2">
          <Disc3 class="h-5 w-5 text-primary" aria-hidden="true" />
          唱片曲库
        </DialogTitle>
        <DialogDescription>
          {{ admin.isLoggedIn ? '管理歌曲、补充唱片封面或上传新的音乐。' : '查看当前曲库中的所有歌曲。' }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex items-center justify-between gap-4 border-b border-border bg-muted/30 px-6 py-3">
        <p class="text-sm text-muted-foreground">共 {{ store.songs.length }} 首歌曲</p>
        <Button v-if="admin.isLoggedIn" size="sm" @click="showUpload = true">
          <Upload class="mr-2 h-4 w-4" aria-hidden="true" />
          上传歌曲
        </Button>
      </div>

      <div class="min-h-48 overflow-y-auto px-6 py-4 sm:max-h-[55vh]">
        <p v-if="error" class="mb-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {{ error }}
        </p>

        <div v-if="store.loading" class="grid place-items-center gap-2 py-12 text-muted-foreground" role="status">
          <LoaderCircle class="h-6 w-6 animate-spin" aria-hidden="true" />
          <p class="text-sm">正在读取曲库…</p>
        </div>
        <div v-else-if="store.isEmpty" class="grid place-items-center gap-2 py-12 text-muted-foreground">
          <Disc3 class="h-8 w-8 opacity-50" aria-hidden="true" />
          <p class="text-sm">曲库里还没有歌曲</p>
        </div>
        <ul v-else class="grid gap-2" aria-label="歌曲列表">
          <li
            v-for="(song, idx) in store.songs"
            :key="song.filename"
            role="button"
            tabindex="0"
            :aria-label="`播放《${song.title}》`"
            class="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border bg-card p-2.5 shadow-sm transition-[transform,background-color,border-color,box-shadow] duration-200 hover:border-primary/45 hover:bg-primary/10 hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="song.filename === store.currentSong?.filename ? 'border-primary/50 bg-primary/10' : 'border-border'"
            @click="selectSong(song.filename)"
            @keydown.enter.prevent="selectSong(song.filename)"
            @keydown.space.prevent="selectSong(song.filename)"
          >
            <button
              v-if="admin.isLoggedIn"
              type="button"
              class="group relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :aria-label="song.hasCover ? `替换《${song.title}》的封面` : `为《${song.title}》上传封面`"
              :disabled="coverUploadingFor === song.filename"
              @click.stop="pickCover(song.filename)"
            >
              <img
                v-if="song.hasCover"
                :src="`${store.getCoverUrl(song.filename)}?v=${song.coverVersion || 0}`"
                alt=""
                class="h-full w-full object-cover transition-opacity group-hover:opacity-70"
              />
              <ImagePlus v-else class="h-5 w-5" aria-hidden="true" />
              <LoaderCircle
                v-if="coverUploadingFor === song.filename"
                class="absolute h-5 w-5 animate-spin text-primary"
                aria-hidden="true"
              />
            </button>
            <div
              v-else
              class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <img
                v-if="song.hasCover"
                :src="`${store.getCoverUrl(song.filename)}?v=${song.coverVersion || 0}`"
                alt=""
                class="h-full w-full object-cover"
              />
              <Disc3 v-else class="h-5 w-5" />
            </div>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-foreground">{{ song.title }}</p>
              <p class="truncate text-xs text-muted-foreground">{{ song.artist || 'Unknown' }}</p>
            </div>

            <div v-if="admin.isLoggedIn" class="flex shrink-0 flex-col">
              <button
                type="button"
                class="rounded p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-30"
                :disabled="idx === 0"
                :aria-label="`上移《${song.title}》`"
                @click.stop="moveTrack(idx, -1)"
              >
                <ChevronUp class="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="rounded p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-30"
                :disabled="idx === store.songs.length - 1"
                :aria-label="`下移《${song.title}》`"
                @click.stop="moveTrack(idx, 1)"
              >
                <ChevronDown class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div v-if="admin.isLoggedIn && pendingDelete === song.filename" class="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="destructive"
                :disabled="deleting === song.filename"
                @click.stop="confirmDelete(song.filename)"
              >
                {{ deleting === song.filename ? '删除中…' : '确认' }}
              </Button>
              <Button size="sm" variant="ghost" :disabled="deleting === song.filename" @click.stop="pendingDelete = null">
                取消
              </Button>
            </div>
            <Button
              v-else-if="admin.isLoggedIn"
              size="icon"
              variant="ghost"
              class="shrink-0 text-muted-foreground hover:text-destructive"
              :aria-label="`删除歌曲《${song.title}》`"
              @click.stop="pendingDelete = song.filename"
            >
              <Trash2 class="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        </ul>
      </div>
    </DialogContent>
  </Dialog>

  <MusicUploadDialog v-model:open="showUpload" />
</template>
