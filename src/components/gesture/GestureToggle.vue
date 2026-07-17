<script setup lang="ts">
import { ref } from 'vue'
import { Hand, Loader2, X } from 'lucide-vue-next'
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
import { useHandGesture } from '@/composables/useHandGesture'

const emit = defineEmits<{
  palm: []
  pinch: []
  snap: []
  middleFinger: []
  swipe: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const showPermission = ref(false)

const { isActive, isLoading, error, start, stop } = useHandGesture(
  videoRef,
  () => emit('palm'),
  () => emit('pinch'),
  () => emit('snap'),
  () => emit('middleFinger'),
  () => emit('swipe'),
)

async function requestPermission() {
  showPermission.value = false
  await start()
}
</script>

<template>
  <!-- 角落按钮 -->
  <div class="absolute bottom-6 right-6 z-40 flex items-center gap-2">
    <Transition name="fade">
      <div
        v-if="isActive"
        class="relative w-12 h-12 rounded-full overflow-hidden border-2 border-primary bg-card shadow-md"
      >
        <video ref="videoRef" class="w-full h-full object-cover scale-x-[-1]" playsinline muted />
        <div
          class="absolute inset-0 ring-2 ring-primary/50 rounded-full pointer-events-none animate-pulse-soft"
        />
      </div>
    </Transition>

    <Button
      v-if="!isActive"
      variant="ghost"
      size="icon"
      class="h-9 w-9 rounded-full bg-card backdrop-blur-sm border border-border hover:bg-card hover:border-primary/40 transition-all"
      :disabled="isLoading"
      aria-label="启用手势识别"
      @click="showPermission = true"
    >
      <Loader2 v-if="isLoading" class="h-4 w-4 animate-spin" />
      <Hand v-else class="h-4 w-4 text-muted-foreground" />
    </Button>
    <Button
      v-else
      variant="ghost"
      size="icon"
      class="h-9 w-9 rounded-full bg-destructive/15 backdrop-blur-sm border border-destructive/30 hover:bg-destructive/25 transition-all"
      aria-label="关闭手势识别"
      @click="stop"
    >
      <X class="h-4 w-4 text-destructive" />
    </Button>
  </div>

  <!-- 摄像头权限 Dialog -->
  <Dialog v-model:open="showPermission">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>启用手势识别</DialogTitle>
        <DialogDescription>
          需要访问摄像头来识别手势,支持：<br>手掌张开展开<br>“OK”手势收起<br>食指扫动让桌宠切换主题<br>打响指播放歌曲
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="ghost">取消</Button>
        </DialogClose>
        <Button @click="requestPermission">
          <Hand class="h-3.5 w-3.5" />
          允许并启动
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 错误提示 -->
  <Transition name="fade">
    <div
      v-if="error"
      class="absolute bottom-20 right-6 z-40 max-w-[260px] bg-destructive/15 border border-destructive/40 text-destructive text-xs px-3 py-2 rounded-md backdrop-blur-sm shadow-md"
    >
      {{ error }}
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-out);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
