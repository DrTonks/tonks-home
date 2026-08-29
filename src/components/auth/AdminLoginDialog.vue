<script setup lang="ts">
import { ref, watch } from 'vue'
import { Lock } from 'lucide-vue-next'
import { useAdminStore } from '@/stores/admin'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const open = defineModel<boolean>('open')
const admin = useAdminStore()
const secret = ref('')
const error = ref('')
const submitting = ref(false)

watch(open, (visible) => {
  if (!visible) return
  secret.value = ''
  error.value = ''
})

async function submitLogin() {
  const value = secret.value.trim()
  if (!value) {
    error.value = '请输入密钥'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    const ok = await admin.login(value)
    if (ok) open.value = false
    else error.value = '密钥不正确，请重试'
  } catch {
    error.value = '验证失败，请检查网络后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Lock class="h-4 w-4 text-primary" aria-hidden="true" />
          管理员登录
        </DialogTitle>
        <DialogDescription>输入现有管理员密钥以启用社区管理功能。</DialogDescription>
      </DialogHeader>
      <div class="space-y-2 py-2">
        <input
          v-model="secret"
          type="password"
          autocomplete="current-password"
          :disabled="submitting"
          class="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          placeholder="管理员密钥"
          @keyup.enter="submitLogin"
        />
        <p v-if="error" class="text-[11px] text-destructive" role="alert">{{ error }}</p>
      </div>
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="ghost" :disabled="submitting">取消</Button>
        </DialogClose>
        <Button :disabled="submitting" @click="submitLogin">
          {{ submitting ? '验证中…' : '登录' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
