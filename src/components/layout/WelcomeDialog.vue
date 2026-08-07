<script lang="ts">
/**
 * 欢迎弹窗版本号。
 * 修改此值后，所有已访问过的用户都会再次看到欢迎弹窗（公告效果）。
 * 例如从 '1.1' 改为 '1.2'，浏览器发现版本不一致就会重新弹出。
 */
export const WELCOME_VERSION = '1.1'
export const WELCOME_LS_KEY = 'welcome_shown_version'
</script>

<script setup lang="ts">
/**
 * WelcomeDialog — 首次访问欢迎弹窗。
 * 复用 GestureToggle / AdminAuth 同款 Dialog 组件。
 */
import { ref, watch } from 'vue'
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

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  confirm: []
}>()

const open = ref(false)
let confirmed = false

function onOpenChange(v: boolean) {
  if (!v && !confirmed) {
    confirmed = true
    emit('confirm')
  }
}

watch(() => props.visible, (v) => {
  open.value = v
  if (v) confirmed = false // 每次打开重置 guard
})
</script>

<template>
  <Dialog v-model:open="open" @update:open="onOpenChange">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>欢迎来访！这里是Tonks的个人网站：</DialogTitle>
        <DialogDescription as="div" class="text-left space-y-3 pt-2">
          <p>· 本站会自动跟踪和更新个人动态（部分数据来源于<a href="https://blog.tonks.top" target="_blank" rel="noopener noreferrer">我的博客</a>）
          </p>
          <p>· 可能不定时安利最近听过的歌</p>
          <p>· 右键桌宠可唤出菜单，可以和它们互动</p>
          <p>· 左键点击桌宠可以戳一戳（不要戳太过了！）</p>
          <p>· 桌宠偶尔会通过提问来记录与你的回忆</p>
          <p>· 天气播报相关：仅通过访客ip来查询当地天气情况，数据缓存在本地，不会用于其他目的</p>
          <p>· 右下角可开启网站手势控制模式</p>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose as-child>
          <Button>继续浏览</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
