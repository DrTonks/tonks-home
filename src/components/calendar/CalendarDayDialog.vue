<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Trash2, Plus } from 'lucide-vue-next'
import { useCalendarStore } from '@/stores/calendar'
import { useAdminStore } from '@/stores/admin'
import type { CalendarEvent, EventType } from '@/api/calendar'
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
  date: string | null
  events: CalendarEvent[]
  holidays: string[]
}>()

const open = defineModel<boolean>('open')

const emit = defineEmits<{ changed: [] }>()

const store = useCalendarStore()
const admin = useAdminStore()

const newEventName = ref('')
const newEventType = ref<EventType>('personal')
const isSaving = ref(false)

const dateLabel = computed(() => {
  if (!props.date) return ''
  const d = new Date(props.date)
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()]
  return `${props.date} · ${weekday}`
})

watch(open, (val) => {
  if (!val) {
    newEventName.value = ''
    newEventType.value = 'personal'
  }
})

function typeColor(type: string): string {
  if (type === 'work') return 'hsl(var(--color-event-work))'
  if (type === 'personal') return 'hsl(var(--color-mint))'
  return 'hsl(var(--color-silver))'
}

function typeLabel(type: string): string {
  if (type === 'work') return '工作'
  if (type === 'personal') return '个人'
  return '节日'
}

async function addEvent() {
  if (!props.date || !newEventName.value.trim()) return
  isSaving.value = true
  try {
    await store.addEvent({
      date: props.date,
      name: newEventName.value.trim(),
      type: newEventType.value,
    })
    newEventName.value = ''
    newEventType.value = 'personal'
    emit('changed')
  } finally {
    isSaving.value = false
  }
}

async function removeEvent(id: string) {
  await store.deleteEvent(id)
  emit('changed')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ dateLabel }}</DialogTitle>
        <DialogDescription v-if="events.length || holidays.length">
          {{ holidays.length ? holidays.join(' · ') + (events.length ? ' | ' + events.length + ' 个事件' : '') : events.length + ' 个事件' }}
        </DialogDescription>
        <DialogDescription v-else>当日暂无事件</DialogDescription>
      </DialogHeader>

      <!-- 节日 -->
      <div v-if="holidays.length" class="space-y-1.5 mb-2">
        <div v-for="(h, i) in holidays" :key="i" class="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
          <span class="text-sm">🎉</span>
          <span class="flex-1 text-sm font-medium text-amber-700 dark:text-amber-400 truncate">{{ h }}</span>
        </div>
      </div>

      <!-- 已有事件 -->
      <div v-if="events.length" class="space-y-1.5">
        <div
          v-for="e in events"
          :key="e.id"
          class="flex items-center gap-2 p-2 rounded-md bg-muted"
        >
          <span
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :style="{ background: typeColor(e.type) }"
          />
          <span class="flex-1 text-sm text-foreground truncate">{{ e.name }}</span>
          <span class="text-[10px] text-muted-foreground uppercase tracking-wider">
            {{ typeLabel(e.type) }}
          </span>
          <Button
            v-if="admin.isLoggedIn"
            variant="ghost"
            size="icon-sm"
            class="h-6 w-6 shrink-0 hover:text-destructive"
            aria-label="删除事件"
            @click="removeEvent(e.id)"
          >
            <Trash2 class="h-3 w-3" />
          </Button>
        </div>
      </div>

      <!-- 添加事件表单（管理员） -->
      <div v-if="admin.isLoggedIn" class="border-t border-border pt-3 mt-2">
        <p class="text-xs font-medium text-foreground mb-2">添加事件</p>
        <div class="space-y-2">
          <input
            v-model="newEventName"
            type="text"
            class="w-full px-3 py-2 text-sm bg-background/60 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            placeholder="事件名称"
            @keyup.enter="addEvent"
          />
          <div class="flex gap-1.5">
            <button
              v-for="t in (['personal', 'work', 'holiday'] as EventType[])"
              :key="t"
              class="flex-1 py-1.5 text-[11px] rounded-md border transition-all duration-fast"
              :class="
                newEventType === t
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
              "
              @click="newEventType = t"
            >
              {{ typeLabel(t) }}
            </button>
          </div>
          <Button
            :disabled="!newEventName.trim() || isSaving"
            size="sm"
            class="w-full"
            @click="addEvent"
          >
            <Plus class="h-3.5 w-3.5" />
            {{ isSaving ? '保存中…' : '保存' }}
          </Button>
        </div>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="ghost">关闭</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
