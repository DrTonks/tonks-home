<script setup lang="ts">
import { useMusicStore } from '@/stores/music'
import { useAdminStore } from '@/stores/admin'
import { Upload, Trash2 } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import VinylDisc from './VinylDisc.vue'
import MusicUploadDialog from './MusicUploadDialog.vue'
import { ref } from 'vue'

const store = useMusicStore()
const admin = useAdminStore()

const showUpload = ref(false)

function onRemove() {
  if (store.currentSong) {
    store.remove(store.currentSong.filename)
  }
}
</script>

<template>
  <Card class="w-[clamp(140px,11vw,180px)] p-4 flex flex-col items-center justify-center gap-2">
    <!-- 管理员按钮（顶部小） -->
    <div v-if="admin.isLoggedIn" class="flex items-center gap-0.5 self-end -mt-1 -mr-1">
      <Button
        variant="ghost"
        size="icon-sm"
        class="h-6 w-6"
        aria-label="上传音乐"
        @click="showUpload = true"
      >
        <Upload class="h-3 w-3" />
      </Button>
      <Button
        v-if="store.currentSong"
        variant="ghost"
        size="icon-sm"
        class="h-6 w-6 hover:text-destructive"
        aria-label="删除当前歌曲"
        @click="onRemove"
      >
        <Trash2 class="h-3 w-3" />
      </Button>
    </div>

    <!-- 大胶片（播放时旋转） -->
    <VinylDisc :size="120" :spinning="store.isPlaying" />

    <!-- 状态指示 -->
    <p class="text-[10px] text-muted-foreground tabular-nums">
      {{ store.isPlaying ? '播放中' : '已暂停' }}
    </p>

    <MusicUploadDialog v-model:open="showUpload" />
  </Card>
</template>
