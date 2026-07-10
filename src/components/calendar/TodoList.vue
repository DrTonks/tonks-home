<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  CheckCircle2, Circle, Pencil, Plus, Trash2,
} from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { useAdminStore } from '@/stores/admin'
import { getTodos, addTodo, completeTodo, deleteTodo, type Todo } from '@/api/todos'

const admin = useAdminStore()
const todos = ref<Todo[]>([])
const loading = ref(false)
const showDialog = ref(false)
const newText = ref('')
const saving = ref(false)

async function fetchTodos() {
  loading.value = true
  try {
    const res = await getTodos()
    if (res.success) todos.value = res.todos
  } catch { /* ignore */ }
  loading.value = false
}

async function handleAdd() {
  const text = newText.value.trim()
  if (!text || saving.value) return
  saving.value = true
  try {
    await addTodo(text)
    newText.value = ''
    await fetchTodos()
  } catch { /* ignore */ }
  saving.value = false
}

async function handleComplete(todo: Todo) {
  try {
    await completeTodo(todo.id)
    await fetchTodos()
  } catch { /* ignore */ }
}

async function handleDelete(todo: Todo) {
  try {
    await deleteTodo(todo.id)
    await fetchTodos()
  } catch { /* ignore */ }
}

onMounted(() => fetchTodos())
</script>

<template>
  <Card class="w-[clamp(180px,14vw,220px)] p-3">
    <!-- 标题行 -->
    <div class="flex items-center justify-between mb-2">
      <p class="font-heavy text-[11px] text-brand-mint-deep tracking-[0.2em]">
        待办
      </p>
      <Button
        v-if="admin.isLoggedIn"
        variant="ghost"
        size="icon-sm"
        class="h-5 w-5 text-muted-foreground hover:text-primary -mr-1"
        aria-label="编辑待办"
        @click="showDialog = true"
      >
        <Pencil class="h-3 w-3" />
      </Button>
    </div>

    <!-- 列表（默认 3 条） -->
    <div class="space-y-1.5">
      <div
        v-for="t in todos.slice(0, 3)"
        :key="t.id"
        class="flex items-center gap-1.5 w-full group"
      >
        <component
          :is="t.done ? CheckCircle2 : Circle"
          :class="t.done
            ? 'h-3.5 w-3.5 text-brand-mint shrink-0'
            : 'h-3.5 w-3.5 text-muted-foreground/50 shrink-0'"
        />
        <span
          class="text-xs flex-1 truncate"
          :class="t.done ? 'text-muted-foreground line-through' : 'text-foreground'"
        >
          {{ t.text }}
        </span>
      </div>
      <p
        v-if="!loading && todos.length === 0"
        class="text-[11px] text-muted-foreground/60"
      >
        暂无待办
      </p>
    </div>
  </Card>

  <!-- 管理员编辑弹窗 -->
  <Dialog v-model:open="showDialog">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>待办事项</DialogTitle>
        <DialogDescription>管理待办列表</DialogDescription>
      </DialogHeader>

      <!-- 新增输入 -->
      <form class="flex items-center gap-2" @submit.prevent="handleAdd">
        <input
          v-model="newText"
          type="text"
          placeholder="新增待办…"
          maxlength="100"
          class="flex-1 h-8 px-2.5 text-xs rounded-md border border-border/60 bg-background focus:outline-none focus:border-primary/50"
        />
        <Button
          variant="default"
          size="icon-sm"
          class="h-8 w-8 shrink-0"
          :disabled="!newText.trim() || saving"
          type="submit"
        >
          <Plus class="h-4 w-4" />
        </Button>
      </form>

      <!-- 列表 -->
      <div class="max-h-60 overflow-y-auto space-y-1">
        <div
          v-for="t in todos"
          :key="t.id"
          class="flex items-center gap-2 py-1 group"
        >
          <button
            class="shrink-0"
            :class="t.done ? 'text-brand-mint' : 'text-muted-foreground/40 hover:text-primary'"
            @click="!t.done && handleComplete(t)"
          >
            <CheckCircle2 v-if="t.done" class="h-4 w-4" />
            <Circle v-else class="h-4 w-4" />
          </button>
          <span
            class="text-xs flex-1 truncate"
            :class="t.done ? 'text-muted-foreground line-through' : 'text-foreground'"
          >{{ t.text }}</span>
          <button
            class="shrink-0 text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            @click="handleDelete(t)"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </button>
        </div>
        <p
          v-if="!loading && todos.length === 0"
          class="text-xs text-muted-foreground/50 text-center py-4"
        >
          暂无待办
        </p>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="ghost" size="sm">关闭</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
