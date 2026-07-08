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

const admin = useAdminStore()

const showLogin = ref(false)
const showLogoutConfirm = ref(false)
const secret = ref('')
const error = ref('')

function openLogin() {
  secret.value = ''
  error.value = ''
  showLogin.value = true
}

function submitLogin() {
  if (!secret.value.trim()) {
    error.value = '请输入密钥'
    return
  }
  admin.login(secret.value.trim())
  showLogin.value = false
  secret.value = ''
}

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
      class="h-9 w-9 rounded-full bg-card/60 backdrop-blur-sm border border-border/40 hover:bg-card hover:border-primary/40 transition-all"
      aria-label="管理员登录"
      @click="openLogin"
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

  <!-- 登录 Dialog -->
  <Dialog v-model:open="showLogin">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>管理员登录</DialogTitle>
        <DialogDescription>
          输入管理员密钥以启用上传/删除等管理功能。密钥将存储在浏览器本地。
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-2 py-2">
        <input
          v-model="secret"
          type="password"
          class="w-full px-3 py-2 text-sm bg-background/60 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          placeholder="管理员密钥"
          @keyup.enter="submitLogin"
        />
        <p v-if="error" class="text-[11px] text-destructive">{{ error }}</p>
      </div>
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="ghost">取消</Button>
        </DialogClose>
        <Button @click="submitLogin">登录</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 退出确认 Dialog -->
  <Dialog v-model:open="showLogoutConfirm">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>退出管理模式</DialogTitle>
        <DialogDescription>
          退出后将无法使用上传/删除等功能，需要重新输入密钥。
        </DialogDescription>
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
