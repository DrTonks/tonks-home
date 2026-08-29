<script setup lang="ts">
import { ref } from 'vue'
import { Lock, LogOut } from 'lucide-vue-next'
import { useAdminStore } from '@/stores/admin'
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
import AdminLoginDialog from './AdminLoginDialog.vue'

const admin = useAdminStore()

const showLogin = ref(false)
const showLogoutConfirm = ref(false)

function confirmLogout() {
  admin.logout()
  showLogoutConfirm.value = false
}
</script>

<template>
  <!-- 角落按钮 -->
  <div class="absolute bottom-6 left-6 z-40">
    <Button
      v-if="!admin.isLoggedIn"
      variant="ghost"
      size="icon"
      class="h-9 w-9 rounded-full bg-card backdrop-blur-sm border border-border hover:bg-card hover:border-primary/40 transition-all"
      aria-label="管理员登录"
      @click="showLogin = true"
    >
      <Lock class="h-4 w-4 text-muted-foreground" />
    </Button>
    <Button
      v-else
      variant="ghost"
      size="icon"
      class="h-9 w-9 rounded-full bg-destructive/15 backdrop-blur-sm border border-destructive/30 hover:bg-destructive/25 transition-all"
      aria-label="退出管理模式"
      @click="showLogoutConfirm = true"
    >
      <LogOut class="h-4 w-4 text-destructive" />
    </Button>
  </div>

  <AdminLoginDialog v-model:open="showLogin" />

  <!-- 退出确认 Dialog -->
  <Dialog v-model:open="showLogoutConfirm">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>退出管理模式</DialogTitle>
        <DialogDescription>退出后将无法使用上传/删除等功能，需要重新输入密钥。</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="ghost">取消</Button>
        </DialogClose>
        <Button variant="destructive" @click="confirmLogout">
          <LogOut class="h-3.5 w-3.5" />
          确认退出
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
</style>
