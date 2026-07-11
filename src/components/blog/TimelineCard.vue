<script setup lang="ts">
import { Calendar, MapPin, Trophy, ExternalLink } from 'lucide-vue-next'
import { type FeaturedTimeline } from '@/api/blog'

const props = defineProps<{ timeline: FeaturedTimeline }>()

const accentColor = props.timeline.color || 'hsl(var(--secondary))'
</script>

<template>
  <article
    class="relative rounded-md p-3 pl-4 bg-muted overflow-hidden transition-colors hover:bg-muted"
    :style="{ borderLeft: `3px solid ${accentColor}` }"
  >
    <!-- 标题 -->
    <h3 class="text-sm font-semibold text-foreground leading-tight pr-1">
      {{ timeline.title }}
    </h3>

    <!-- 日期 + 地点 -->
    <div
      class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground mt-1.5 mb-2"
    >
      <span class="inline-flex items-center gap-1 tabular-nums">
        <Calendar class="h-3 w-3" />
        {{ timeline.startDate }}
      </span>
      <span v-if="timeline.location" class="inline-flex items-center gap-1">
        <MapPin class="h-3 w-3" />
        {{ timeline.location }}
      </span>
    </div>

    <!-- 组织 -->
    <p
      v-if="timeline.organization"
      class="text-[10px] text-muted-foreground/80 mb-2"
    >
      {{ timeline.organization }}
    </p>

    <!-- 成就 -->
    <div v-if="timeline.achievements?.length" class="space-y-0.5 mb-2">
      <p
        v-for="ach in timeline.achievements"
        :key="ach"
        class="flex items-center gap-1.5 text-[11px] font-medium"
        :style="{ color: accentColor }"
      >
        <Trophy class="h-3 w-3 shrink-0" />
        <span>{{ ach }}</span>
      </p>
    </div>

    <!-- 描述 -->
    <p
      v-if="timeline.description"
      class="text-xs text-muted-foreground line-clamp-3 leading-relaxed"
    >
      {{ timeline.description }}
    </p>

    <!-- 链接 -->
    <div v-if="timeline.links?.length" class="flex items-center gap-3 mt-2">
      <a
        v-for="link in timeline.links"
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
