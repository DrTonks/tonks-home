<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle2, Circle } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'

// 占位待办（后续接入 API）
interface Todo {
  id: number
  text: string
  done: boolean
}

const todos = ref<Todo[]>([
  { id: 1, text: '完成 tonks-home 微调', done: true },
  { id: 2, text: '部署到生产服务器', done: false },
  { id: 3, text: '修复螺旋动画细节', done: false },
])

function toggle(id: number) {
  const t = todos.value.find((x) => x.id === id)
  if (t) t.done = !t.done
}
</script>

<template>
  <Card class="w-[clamp(180px,14vw,220px)] p-3">
    <p class="font-heavy text-[11px] text-brand-mint-deep tracking-[0.2em] mb-2">
      待办
    </p>
    <div class="space-y-1.5">
      <button
        v-for="t in todos.slice(0, 3)"
        :key="t.id"
        class="flex items-center gap-1.5 w-full text-left group"
        @click="toggle(t.id)"
      >
        <CheckCircle2
          v-if="t.done"
          class="h-3.5 w-3.5 text-brand-mint shrink-0"
        />
        <Circle
          v-else
          class="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 transition-colors"
        />
        <span
          class="text-xs flex-1 truncate"
          :class="t.done ? 'text-muted-foreground line-through' : 'text-foreground'"
        >
          {{ t.text }}
        </span>
      </button>
    </div>
  </Card>
</template>
