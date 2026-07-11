<script setup lang="ts">
import { ExternalLink, Trophy } from 'lucide-vue-next'
import { getImageUrl, type FeaturedProject } from '@/api/blog'

defineProps<{ project: FeaturedProject }>()
</script>

<template>
  <article class="space-y-3">
    <!-- 左图右文 -->
    <div class="flex gap-3">
      <!-- 缩略图 -->
      <div
        class="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-muted ring-1 ring-border"
      >
        <img
          v-if="project.image"
          :src="getImageUrl(project.image)"
          :alt="project.title"
          class="w-full h-full object-cover transition-transform duration-normal hover:scale-105"
          loading="lazy"
        />
        <div
          v-else
          class="w-full h-full flex items-center justify-center text-muted-foreground"
        >
          <ExternalLink class="h-5 w-5" />
        </div>
      </div>
      <!-- 文字 -->
      <div class="flex-1 min-w-0">
        <h3 class="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
          {{ project.title }}
        </h3>
        <p
          v-if="project.startDate"
          class="text-[10px] text-muted-foreground mt-1 tabular-nums"
        >
          {{ project.startDate }}
        </p>
        <!-- 标签 -->
        <div v-if="project.tags?.length" class="flex flex-wrap gap-1 mt-1.5">
          <span
            v-for="tag in project.tags.slice(0, 3)"
            :key="tag"
            class="text-[10px] px-1.5 py-0.5 rounded bg-secondary/25 text-secondary-foreground leading-none"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </div>

    <!-- 描述 -->
    <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
      {{ project.description }}
    </p>

    <!-- 奖项 -->
    <div
      v-if="project.award"
      class="flex items-center gap-1.5 text-[11px] text-secondary-foreground dark:text-accent"
    >
      <Trophy class="h-3 w-3" />
      <span>{{ project.award }}</span>
    </div>

    <!-- 链接 -->
    <div v-if="project.links?.length" class="flex items-center gap-3 pt-1">
      <a
        v-for="link in project.links"
        :key="link.url"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/70 transition-colors"
      >
        <ExternalLink class="h-3 w-3" />
        {{ link.name }}
      </a>
    </div>
  </article>
</template>
