<script setup lang="ts">
import { Eye, Heart, MessageCircle } from 'lucide-vue-next'
import { getCategoryIcon } from '@/lib/blog-category-icons'
import { type BlogPost } from '@/api/blog'

defineProps<{ posts: BlogPost[] }>()
const metrics = [
  { key: 'views', label: '浏览', icon: Eye },
  { key: 'likes', label: '点赞', icon: Heart },
  { key: 'comments', label: '评论', icon: MessageCircle },
] as const
function formatCount(value: number | null | undefined) {
  if (value == null) return '—'
  return value >= 10000 ? `${Number((value / 10000).toFixed(1))}万` : String(value)
}
</script>

<template>
  <div class="space-y-1">
    <a
      v-for="post in posts"
      :key="post.link"
      :href="post.link"
      target="_blank"
      rel="noopener noreferrer"
      class="block p-2 rounded-md hover:bg-primary/8 transition-colors group"
    >
      <div class="flex items-start gap-2">
        <svg class="h-3.5 w-3.5 text-primary/80 shrink-0 mt-0.5" viewBox="0 0 24 24"
          role="img" :aria-label="post.category || '文章'" v-html="getCategoryIcon(post.category)" />
        <div class="flex-1 min-w-0">
          <p
            class="text-xs font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1"
          >
            <span class="flex-1 min-w-0 truncate" :title="post.title">{{ post.title }}</span>
            <span class="article-metrics">
              <span v-for="metric in metrics" :key="metric.key" class="article-metric"
                :title="`${metric.label}：${post.stats?.[metric.key] ?? '暂不可用'}`"
                :aria-label="`${metric.label}：${post.stats?.[metric.key] ?? '暂不可用'}`">
                <component :is="metric.icon" class="h-2.5 w-2.5" aria-hidden="true" />
                <span>{{ formatCount(post.stats?.[metric.key]) }}</span>
              </span>
            </span>
          </p>
          <p
            v-if="post.summary"
            class="text-[11px] text-muted-foreground/80 line-clamp-2 mt-1 leading-relaxed"
          >
            {{ post.summary }}
          </p>
        </div>
      </div>
    </a>
    <div
      v-if="!posts.length"
      class="py-6 text-center text-xs text-muted-foreground"
    >
      暂无文章
    </div>
  </div>
</template>

<style scoped>
.article-metrics { display: inline-flex; flex: none; align-items: center; gap: .35rem; margin-left: .2rem; color: hsl(var(--muted-foreground)); font-size: 9px; font-weight: 400; font-variant-numeric: tabular-nums; transition: color .2s ease; }
.article-metric { display: inline-flex; align-items: center; gap: .15rem; white-space: nowrap; }
.group:hover .article-metrics { color: hsl(var(--primary)); }
@media (prefers-reduced-motion: reduce) { .article-metrics { transition: none; } }
</style>
