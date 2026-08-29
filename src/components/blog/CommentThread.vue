<script setup lang="ts">
import { computed, ref } from 'vue'
import { ExternalLink, Reply, ShieldCheck } from 'lucide-vue-next'
import { getCommunityAvatarUrl, type CommunityComment } from '@/api/community'
import type { CommentThread } from '@/lib/community'

const props = defineProps<{
  thread: CommentThread
  adminMode: boolean
  selectedId: number | null
}>()
const emit = defineEmits<{ select: [comment: CommunityComment] }>()

const failedAvatars = ref(new Set<number>())
const items = computed(() => [props.thread.root, ...props.thread.replies])

function markAvatarFailed(id: number) {
  failedAvatars.value = new Set([...failedAvatars.value, id])
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '访客'
}

function formatTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function statusLabel(status: CommunityComment['status']): string {
  return { published: '已发布', pending: '待审核', rejected: '已拒绝' }[status]
}

function select(comment: CommunityComment) {
  if (props.adminMode) emit('select', comment)
}
</script>

<template>
  <section class="relative rounded-2xl border border-border/80 bg-card/70 p-3 shadow-sm">
    <div
      v-if="thread.replies.length"
      class="absolute bottom-4 left-[30px] top-14 w-px bg-gradient-to-b from-primary/35 to-border/20"
      aria-hidden="true"
    />
    <article
      v-for="comment in items"
      :key="comment.id"
      :class="[
        'relative flex gap-3 rounded-xl p-2 transition-[background-color,box-shadow,transform] duration-200',
        comment.parent_id !== null && 'ml-5',
        adminMode &&
          'cursor-pointer hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selectedId === comment.id &&
          'bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]',
      ]"
      :tabindex="adminMode ? 0 : undefined"
      @click="select(comment)"
      @keydown.enter.prevent="select(comment)"
      @keydown.space.prevent="select(comment)"
    >
      <div
        class="relative z-[1] grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground"
      >
        <img
          v-if="comment.status === 'published' && !failedAvatars.has(comment.id)"
          :src="getCommunityAvatarUrl(comment.id)"
          alt=""
          draggable="false"
          class="h-full w-full select-none object-cover"
          @error="markAvatarFailed(comment.id)"
        />
        <span v-else>{{ initials(comment.nickname) }}</span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <a
            v-if="comment.website"
            :href="comment.website"
            target="_blank"
            rel="noopener noreferrer nofollow"
            class="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary"
            @click.stop
          >
            {{ comment.nickname }}
            <ExternalLink class="h-3 w-3" aria-hidden="true" />
          </a>
          <span v-else class="text-sm font-semibold text-foreground">{{ comment.nickname }}</span>
          <span
            v-if="comment.is_admin"
            class="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary"
          >
            <ShieldCheck class="h-3 w-3" aria-hidden="true" />
            站长
          </span>
          <span
            v-if="adminMode"
            :class="[
              'rounded-full px-2 py-0.5 text-[10px] font-medium',
              comment.status === 'published' &&
                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
              comment.status === 'pending' && 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
              comment.status === 'rejected' && 'bg-destructive/10 text-destructive',
            ]"
          >
            {{ statusLabel(comment.status) }}
          </span>
          <time class="text-[10px] text-muted-foreground" :datetime="comment.created_at">
            {{ formatTime(comment.created_at) }}
          </time>
        </div>
        <p
          v-if="comment.parent_id !== null && comment.reply_to_name"
          class="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground"
        >
          <Reply class="h-3 w-3" aria-hidden="true" />
          回复 @{{ comment.reply_to_name }}
        </p>
        <p class="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
          {{ comment.content }}
        </p>
      </div>
    </article>
  </section>
</template>
