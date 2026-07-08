<script setup lang="ts">
import { useMusicStore } from '@/stores/music'
import { useAdminStore } from '@/stores/admin'
import { Upload, Trash2 } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import VinylDisc from './VinylDisc.vue'
import MusicUploadDialog from './MusicUploadDialog.vue'
import { ref, onMounted } from 'vue'

const store = useMusicStore()
const admin = useAdminStore()

const showUpload = ref(false)

onMounted(() => {
  store.fetchList()
})

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

    <!-- 大胶片 + 唱针 -->
    <div class="relative">
      <VinylDisc :size="120" :spinning="store.isPlaying" />
      <!-- 唱针臂：初始水平（0°=flat），播放时逆时针转 -25° 搭上唱片 -->
      <div
        class="absolute top-[8%] -right-[15%] w-[55px] h-[2px] origin-right transition-transform duration-500"
        :class="store.isPlaying ? 'rotate-[-25deg]' : 'rotate-[0deg]'"
        style="
          background: linear-gradient(270deg, #999 30%, #ddd 70%, #999);
          border-radius: 2px;
          box-shadow: 1px 1px 3px rgba(0,0,0,0.15);
        "
      >
        <div class="absolute left-0 -top-[1.5px] w-[5px] h-[5px] rounded-full bg-red-500/80 shadow-sm" />
      </div>
    </div>

    <p class="text-[10px] text-muted-foreground tabular-nums">
      {{ store.isPlaying ? '播放中' : '已暂停' }}
    </p>

    <MusicUploadDialog v-model:open="showUpload" />
  </Card>
</template>
