<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { BadgeCheck, Mail, UserRound } from 'lucide-vue-next'
import type { VisitorIdentity } from '@/lib/community'
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

const props = defineProps<{ identity: VisitorIdentity }>()
const emit = defineEmits<{
  save: [identity: VisitorIdentity, remember: boolean]
}>()
const open = defineModel<boolean>('open')
const form = reactive<VisitorIdentity>({ nickname: '', email: '', website: '' })
const remember = ref(true)
const error = ref('')

watch(open, (visible) => {
  if (!visible) return
  form.nickname = props.identity.nickname
  form.email = props.identity.email
  form.website = props.identity.website
  error.value = ''
})

function saveIdentity() {
  const nickname = form.nickname.trim()
  const email = form.email.trim().toLowerCase()
  const website = form.website.trim()
  if (!nickname) {
    error.value = '请留下一个称呼'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.value = '请填写格式正确的邮箱'
    return
  }
  if (website && !/^https?:\/\/[^\s]+$/i.test(website)) {
    error.value = '网站需要以 http:// 或 https:// 开头'
    return
  }
  emit('save', { nickname, email, website }, remember.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md overflow-hidden p-0">
      <div class="border-b border-border bg-primary/5 px-6 pb-5 pt-6">
        <DialogHeader>
          <p class="font-mono text-[9px] tracking-[0.2em] text-primary/70">VISITOR CARD</p>
          <DialogTitle class="flex items-center gap-2 text-xl">
            <BadgeCheck class="h-5 w-5 text-primary" aria-hidden="true" />
            加入留言群聊
          </DialogTitle>
          <DialogDescription class="leading-5">
            这是一张保存在当前设备上的访客身份卡。邮箱不会公开，目前只验证格式，不代表邮箱所有权已经认证。
          </DialogDescription>
        </DialogHeader>
      </div>

      <form class="grid gap-4 px-6 py-5" @submit.prevent="saveIdentity">
        <label class="grid gap-1.5 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <UserRound class="h-3.5 w-3.5" aria-hidden="true" />
            昵称
            <strong class="text-destructive">*</strong>
          </span>
          <input
            v-model="form.nickname"
            maxlength="30"
            autocomplete="nickname"
            class="identity-input"
            placeholder="想让大家怎么称呼你？"
          />
        </label>

        <label class="grid gap-1.5 text-xs text-muted-foreground">
          <span class="flex items-center gap-1.5">
            <Mail class="h-3.5 w-3.5" aria-hidden="true" />
            邮箱
            <strong class="text-destructive">*</strong>
          </span>
          <input
            v-model="form.email"
            type="email"
            maxlength="254"
            autocomplete="email"
            class="identity-input"
            placeholder="仅用于识别连续发言与生成头像"
          />
        </label>

        <label class="grid gap-1.5 text-xs text-muted-foreground">
          网站（选填）
          <input
            v-model="form.website"
            type="url"
            maxlength="300"
            autocomplete="url"
            class="identity-input"
            placeholder="https://example.com"
          />
        </label>

        <label class="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input v-model="remember" type="checkbox" class="h-4 w-4 accent-primary" />
          在此设备记住这张身份卡
        </label>

        <p
          v-if="error"
          class="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {{ error }}
        </p>

        <DialogFooter class="mt-1">
          <DialogClose as-child>
            <Button variant="ghost">暂不加入</Button>
          </DialogClose>
          <Button type="submit">保存并继续</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.identity-input {
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 0.65rem;
  background: hsl(var(--background) / 0.72);
  padding: 0.65rem 0.75rem;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.identity-input:focus {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--background));
  outline: none;
  box-shadow: 0 0 0 3px hsl(var(--ring) / 0.16);
}
</style>
