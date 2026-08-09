<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RefreshCw, Trash2, Inbox } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  deleteRecommendation,
  getRecommendations,
  recommendationSourceLabel,
  type Recommendation,
  type RecommendationCategory,
} from '@/api/recommendations'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: false })
const emit = defineEmits<{ close: [] }>()

const open = computed({
  get: () => props.visible,
  set: (value) => {
    if (!value) emit('close')
  },
})
const items = ref<Recommendation[]>([])
const category = ref<RecommendationCategory | ''>('')
const date = ref('')
const loading = ref(false)
const error = ref('')
const pendingDeleteId = ref<number | null>(null)
const deletingId = ref<number | null>(null)

const categoryLabels: Record<RecommendationCategory, string> = {
  music: '歌曲',
  book: '书籍',
  game: '游戏',
  anime: '番剧',
}

async function load() {
  loading.value = true
  error.value = ''
  pendingDeleteId.value = null
  try {
    items.value = await getRecommendations({
      ...(category.value ? { category: category.value } : {}),
      ...(date.value ? { date: date.value } : {}),
    })
  } catch (cause) {
    console.warn('[recommendations] load failed', cause)
    error.value = '推荐列表加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function confirmDelete(id: number) {
  deletingId.value = id
  error.value = ''
  try {
    await deleteRecommendation(id)
    items.value = items.value.filter((item) => item.id !== id)
    pendingDeleteId.value = null
  } catch (cause) {
    console.warn('[recommendations] delete failed', cause)
    error.value = '删除失败，请确认管理员登录状态后重试'
  } finally {
    deletingId.value = null
  }
}

function formatTime(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) void load()
  },
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85vh] max-w-2xl overflow-hidden p-0">
      <DialogHeader class="border-b border-border px-6 pb-4 pt-6">
        <DialogTitle class="flex items-center gap-2">
          <Inbox class="h-5 w-5 text-primary" aria-hidden="true" />
          推荐收件箱
        </DialogTitle>
        <DialogDescription>查看访客主动发送的歌曲、书籍、游戏和番剧推荐。</DialogDescription>
      </DialogHeader>

      <div
        class="grid gap-3 border-b border-border bg-muted/30 px-6 py-4 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label class="grid gap-1 text-xs text-muted-foreground">
          分类
          <select
            v-model="category"
            class="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">全部分类</option>
            <option value="music">歌曲</option>
            <option value="book">书籍</option>
            <option value="game">游戏</option>
            <option value="anime">番剧</option>
          </select>
        </label>
        <label class="grid gap-1 text-xs text-muted-foreground">
          日期
          <input
            v-model="date"
            type="date"
            class="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <Button class="self-end" :disabled="loading" @click="load">
          <RefreshCw :class="['mr-2 h-4 w-4', { 'animate-spin': loading }]" aria-hidden="true" />
          筛选
        </Button>
      </div>

      <div class="min-h-48 overflow-y-auto px-6 py-4 sm:max-h-[55vh]">
        <p v-if="loading" class="py-12 text-center text-sm text-muted-foreground" role="status">
          正在读取推荐…
        </p>
        <p
          v-else-if="error"
          class="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {{ error }}
        </p>
        <div
          v-else-if="!items.length"
          class="grid place-items-center gap-2 py-12 text-muted-foreground"
        >
          <Inbox class="h-8 w-8 opacity-50" aria-hidden="true" />
          <p class="text-sm">当前筛选条件下还没有推荐</p>
        </div>
        <ul v-else class="grid gap-3" aria-label="推荐列表">
          <li
            v-for="item in items"
            :key="item.id"
            class="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {{ categoryLabels[item.category] }}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    {{ recommendationSourceLabel(item) }}
                  </span>
                  <time class="text-xs text-muted-foreground" :datetime="item.created_at">
                    {{ formatTime(item.created_at) }}
                  </time>
                </div>
                <p class="break-words text-sm leading-6 text-foreground">{{ item.content }}</p>
              </div>

              <div v-if="pendingDeleteId === item.id" class="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="destructive"
                  :disabled="deletingId === item.id"
                  @click="confirmDelete(item.id)"
                >
                  {{ deletingId === item.id ? '删除中' : '确认' }}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  :disabled="deletingId === item.id"
                  @click="pendingDeleteId = null"
                >
                  取消
                </Button>
              </div>
              <Button
                v-else
                size="icon"
                variant="ghost"
                class="shrink-0 text-muted-foreground hover:text-destructive"
                :aria-label="`删除推荐：${item.content}`"
                @click="pendingDeleteId = item.id"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        </ul>
      </div>
    </DialogContent>
  </Dialog>
</template>
