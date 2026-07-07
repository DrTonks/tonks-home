<script setup lang="ts">
import { FileText, ArrowUpRight } from 'lucide-vue-next'
import { type BlogPost } from '@/api/blog'

defineProps<{ posts: BlogPost[] }>()
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
        <FileText class="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <div class="flex-1 min-w-0">
          <p
            class="text-xs font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors flex items-center gap-1"
          >
            <span class="flex-1 truncate">{{ post.title }}</span>
            <ArrowUpRight
              class="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            />
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
