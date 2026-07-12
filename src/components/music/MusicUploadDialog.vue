<script setup lang="ts">
import { ref, watch } from 'vue'
import { Upload } from 'lucide-vue-next'
import { useMusicStore } from '@/stores/music'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const open = defineModel<boolean>('open')

const store = useMusicStore()

const uploadTitle = ref('')
const uploadArtist = ref('')
const uploadFile = ref<File | null>(null)
const uploadLyrics = ref<File | null>(null)
const isUploading = ref(false)

watch(open, (val) => {
  if (!val) {
    uploadTitle.value = ''
    uploadArtist.value = ''
    uploadFile.value = null
    uploadLyrics.value = null
  }
})

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

function pickLyrics() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.lrc,text/plain'
  input.onchange = () => {
    if (input.files && input.files[0]) uploadLyrics.value = input.files[0]
  }
  input.click()
}

async function doUpload() {
  if (!uploadFile.value) return
  isUploading.value = true
  try {
    await store.upload(uploadFile.value, uploadTitle.value, uploadArtist.value, uploadLyrics.value)
    open.value = false
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
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
        <div class="space-y-1.5">
          <label class="text-xs text-muted-foreground">歌词（可选 · LRC）</label>
          <button
            class="w-full px-3 py-2 text-sm text-left bg-background/60 border border-border rounded-md hover:border-primary/50 transition-colors truncate"
            @click="pickLyrics"
          >
            <span :class="uploadLyrics ? 'text-foreground' : 'text-muted-foreground'">
              {{ uploadLyrics ? uploadLyrics.name : '选择 .lrc 文件（不选则为纯音乐）' }}
            </span>
          </button>
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
</template>
