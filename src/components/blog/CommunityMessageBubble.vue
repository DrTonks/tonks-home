<script setup lang="ts">
import { computed, ref } from 'vue'
import { AtSign, ExternalLink, MessageSquareReply, ShieldCheck } from 'lucide-vue-next'
import { getCommunityAvatarUrl, type CommunityComment } from '@/api/community'

const props = defineProps<{
  comment: CommunityComment
  parent?: CommunityComment
  adminMode: boolean
  selected: boolean
  localPending?: boolean
}>()
const emit = defineEmits<{
  reply: [comment: CommunityComment]
  inspect: [comment: CommunityComment]
}>()
const avatarFailed = ref(false)
// QQ-style direction is viewer-relative: only this browser's own messages go right.
// Admin identity changes the visual treatment, never the direction by itself.
const alignedRight = computed(() => props.comment.owned)

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
  if (props.localPending) return '审核中，仅本机可见'
  return { published: '已发布', pending: '待审核', rejected: '已拒绝' }[status]
}
</script>

<template>
  <article
    :class="[
      'message-row group/message',
      comment.is_admin ? 'is-admin' : 'is-visitor',
      comment.owned && 'is-own',
      alignedRight && 'is-right',
      selected && 'is-selected',
      localPending && 'is-local-pending',
    ]"
  >
    <div v-if="!alignedRight" :class="['message-avatar', comment.is_admin && 'is-admin-avatar']">
      <img
        v-if="comment.status === 'published' && !avatarFailed && comment.id > 0"
        :src="getCommunityAvatarUrl(comment.id)"
        alt=""
        draggable="false"
        @error="avatarFailed = true"
      />
      <span v-else>{{ initials(comment.nickname) }}</span>
    </div>

    <div class="min-w-0 max-w-[min(78%,38rem)]">
      <div :class="['message-meta', alignedRight && 'justify-end']">
        <a
          v-if="comment.website"
          :href="comment.website"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="message-author hover:text-primary"
        >
          {{ comment.nickname }}
          <ExternalLink class="h-3 w-3" aria-hidden="true" />
        </a>
        <span v-else class="message-author">{{ comment.nickname }}</span>
        <span v-if="comment.is_admin" class="message-admin-badge">
          <ShieldCheck class="h-3 w-3" aria-hidden="true" />
          站长
        </span>
        <time :datetime="comment.created_at">{{ formatTime(comment.created_at) }}</time>
      </div>

      <div class="message-bubble">
        <div v-if="comment.parent_id !== null" class="message-quote">
          <AtSign class="h-3 w-3 shrink-0" aria-hidden="true" />
          <div class="min-w-0">
            <strong>{{ parent?.nickname || comment.reply_to_name || '已删除的消息' }}</strong>
            <p>{{ parent?.content || '原消息已不可见' }}</p>
          </div>
        </div>
        <p class="whitespace-pre-wrap break-words text-sm leading-6">{{ comment.content }}</p>
      </div>

      <div :class="['message-actions', alignedRight && 'justify-end']">
        <span
          v-if="localPending || (adminMode && comment.status !== 'published')"
          :class="[
            'message-status',
            (localPending || comment.status === 'pending') && 'is-pending',
            comment.status === 'rejected' && 'is-rejected',
          ]"
        >
          {{ statusLabel(comment.status) }}
        </span>
        <button
          v-if="!localPending && comment.status === 'published'"
          type="button"
          class="message-action"
          @click="emit('reply', comment)"
        >
          <MessageSquareReply class="h-3 w-3" aria-hidden="true" />
          回复
        </button>
        <button
          v-if="adminMode && !localPending"
          type="button"
          class="message-action"
          @click="emit('inspect', comment)"
        >
          审核
        </button>
      </div>
    </div>

    <div
      v-if="alignedRight"
      :class="['message-avatar', comment.is_admin ? 'is-admin-avatar' : 'is-own-avatar']"
    >
      <img
        v-if="comment.status === 'published' && !avatarFailed && comment.id > 0"
        :src="getCommunityAvatarUrl(comment.id)"
        alt=""
        draggable="false"
        @error="avatarFailed = true"
      />
      <span v-else>{{ initials(comment.nickname) }}</span>
    </div>
  </article>
</template>

<style scoped>
.message-row {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.48rem 0;
}

.message-row.is-right {
  justify-content: flex-end;
}

.message-avatar {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
  font-weight: 700;
}

.message-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.is-admin-avatar {
  border: 1px solid hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.14);
  box-shadow:
    0 0 0 3px hsl(var(--primary) / 0.08),
    0 5px 16px hsl(var(--primary) / 0.15);
}

.is-own-avatar {
  background: hsl(var(--primary) / 0.08);
}

.message-meta,
.message-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.message-meta {
  min-height: 1.25rem;
  margin-bottom: 0.25rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.message-author {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-admin-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border-radius: 999px;
  border: 1px solid hsl(var(--primary) / 0.24);
  background: hsl(var(--primary) / 0.14);
  padding: 0.15rem 0.4rem;
  color: hsl(var(--primary));
  font-size: 0.55rem;
  font-weight: 650;
}

.message-bubble {
  border: 0;
  border-radius: 0.25rem 0.7rem 0.7rem;
  background: hsl(var(--card));
  padding: 0.6rem 0.75rem;
  color: hsl(var(--foreground) / 0.92);
  box-shadow: 0 1px 2px hsl(var(--foreground) / 0.07);
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.is-own .message-bubble {
  border-radius: 0.7rem 0.25rem 0.7rem 0.7rem;
  background: hsl(var(--primary) / 0.11);
}

.is-admin .message-bubble {
  position: relative;
  border: 1px solid hsl(var(--primary) / 0.22);
  background: linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.11));
  box-shadow:
    0 7px 22px hsl(var(--primary) / 0.09),
    inset 0 1px hsl(var(--background) / 0.35);
}

.is-admin.is-right .message-bubble {
  border-radius: 0.7rem 0.25rem 0.7rem 0.7rem;
}

.is-admin .message-author {
  color: hsl(var(--primary));
}

.is-selected .message-bubble {
  box-shadow: 0 0 0 2px hsl(var(--primary) / 0.16);
}

.is-local-pending {
  opacity: 0.72;
}

.message-quote {
  display: flex;
  gap: 0.35rem;
  margin-bottom: 0.55rem;
  border-left: 2px solid hsl(var(--primary) / 0.45);
  border-radius: 0.2rem;
  background: hsl(var(--foreground) / 0.045);
  padding: 0.4rem 0.5rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.625rem;
}

.message-quote strong {
  color: hsl(var(--foreground) / 0.82);
}

.message-quote p {
  overflow: hidden;
  margin-top: 0.1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-actions {
  min-height: 1.35rem;
  margin-top: 0.2rem;
  opacity: 0;
  transition: opacity 150ms ease;
}

.message-row:hover .message-actions,
.message-row:focus-within .message-actions,
.message-status {
  opacity: 1;
}

.message-action {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border-radius: 0.35rem;
  padding: 0.2rem 0.35rem;
  color: hsl(var(--muted-foreground));
  font-size: 0.6rem;
  transition:
    color 150ms ease,
    background-color 150ms ease;
}

.message-action:hover {
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
}

.message-status {
  border-radius: 999px;
  padding: 0.18rem 0.45rem;
  font-size: 0.55rem;
}

.message-status.is-pending {
  background: hsl(38 90% 50% / 0.12);
  color: hsl(34 75% 42%);
}

.message-status.is-rejected {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
}

@media (hover: none) {
  .message-actions {
    opacity: 1;
  }
}

@media (max-width: 639px) {
  .message-avatar {
    width: 2rem;
    height: 2rem;
  }

  .message-row {
    gap: 0.5rem;
  }
}
</style>
