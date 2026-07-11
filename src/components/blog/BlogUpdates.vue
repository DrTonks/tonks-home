<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { FolderGit2, History, FileText, NotebookPen, Github } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { getBlogPosts, type BlogPostsResponse } from '@/api/blog'
import { useThemeStore } from '@/stores/theme'
import ProjectCard from './ProjectCard.vue'
import TimelineCard from './TimelineCard.vue'
import ArticleList from './ArticleList.vue'

const data = ref<BlogPostsResponse | null>(null)
const loading = ref(true)
const activeTab = ref('article')
const theme = useThemeStore()

// 滑块指示器：数学计算（3 个等宽 tab 各占 1/3），首帧即正确，
// 不依赖 DOM 测量，避免首次加载字体/布局未稳导致的宽度覆盖不全。
const TAB_ORDER = ['article', 'project', 'timeline'] as const
const indicatorStyle = computed(() => {
  const idx = Math.max(0, TAB_ORDER.indexOf(activeTab.value as (typeof TAB_ORDER)[number]))
  const width = 100 / TAB_ORDER.length
  return { left: `${idx * width}%`, width: `${width}%` }
})

onMounted(async () => {
  try {
    data.value = await getBlogPosts(3)
  } catch (e) {
    console.error('fetchBlogPosts failed:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <Card class="w-[clamp(280px,24vw,360px)] p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-kai text-base font-medium tracking-wider text-brand-sky-deep">
        我的最新动态！
      </h2>
      <TooltipProvider>
        <div class="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <a
                href="https://blog.tonks.top/"
                target="_blank"
                rel="noopener noreferrer"
                class="social-btn"
                aria-label="博客"
              >
                <NotebookPen class="h-3.5 w-3.5" />
              </a>
            </TooltipTrigger>
            <TooltipContent>我的博客</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <a
                href="https://space.bilibili.com/519765623"
                target="_blank"
                rel="noopener noreferrer"
                class="social-btn"
                aria-label="哔哩哔哩"
              >
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                  <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zm3.173 3.867c.373 0 .684.124.933.373.25.249.383.569.4.96v.573c-.017.391-.15.711-.4.96a1.294 1.294 0 0 1-.933.373 1.34 1.34 0 0 1-.947-.373c-.258-.249-.396-.569-.413-.96v-.573c.017-.391.155-.711.413-.96.26-.249.575-.373.947-.373zm6.987 0c.373 0 .684.124.933.373.25.249.383.569.4.96v.573c-.017.391-.15.711-.4.96a1.294 1.294 0 0 1-.933.373 1.34 1.34 0 0 1-.947-.373c-.258-.249-.396-.569-.413-.96v-.573c.017-.391.155-.711.413-.96.26-.249.575-.373.947-.373z"/>
                </svg>
              </a>
            </TooltipTrigger>
            <TooltipContent>bilibili 空间</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <a
                href="https://github.com/DrTonks"
                target="_blank"
                rel="noopener noreferrer"
                class="social-btn"
                aria-label="GitHub"
              >
                <Github class="h-3.5 w-3.5" />
              </a>
            </TooltipTrigger>
            <TooltipContent>GitHub 主页</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>

    <Tabs v-model="activeTab">
      <!-- 带滑动指示器的导航栏 -->
      <div class="relative mb-3">
        <TabsList class="grid grid-cols-3 w-full h-8 bg-muted/40 backdrop-blur-sm relative">
          <TabsTrigger value="article" class="text-[11px] gap-1 data-[state=active]:text-primary data-[state=active]:font-semibold transition-colors duration-300">
            <FileText class="h-3 w-3" />
            文章
          </TabsTrigger>
          <TabsTrigger value="project" class="text-[11px] gap-1 data-[state=active]:text-primary data-[state=active]:font-semibold transition-colors duration-300">
            <FolderGit2 class="h-3 w-3" />
            项目
          </TabsTrigger>
          <TabsTrigger value="timeline" class="text-[11px] gap-1 data-[state=active]:text-primary data-[state=active]:font-semibold transition-colors duration-300">
            <History class="h-3 w-3" />
            时光机
          </TabsTrigger>
        </TabsList>
        <!-- 滑动玻璃指示器（仅亮色显示）-->
        <div
          v-if="!theme.isDark"
          class="absolute bottom-0 h-0.5 bg-primary/80 rounded-full transition-all duration-300 ease-out"
          :style="indicatorStyle"
        />
      </div>

      <!-- 内容区（Transition 实现切换淡入淡出） -->
      <div v-if="loading">
        <Skeleton class="h-20 w-full" />
      </div>
      <Transition v-else name="blog-fade" mode="out-in">
        <div v-if="activeTab === 'article'" :key="'article'">
          <ArticleList :posts="data?.posts || []" />
        </div>
        <div v-else-if="activeTab === 'project'" :key="'project'">
          <ProjectCard v-if="data?.featuredProject" :project="data.featuredProject" />
          <div v-else class="py-6 text-center text-xs text-muted-foreground">暂无项目</div>
        </div>
        <div v-else :key="'timeline'">
          <TimelineCard v-if="data?.featuredTimeline" :timeline="data.featuredTimeline" />
          <div v-else class="py-6 text-center text-xs text-muted-foreground">暂无时光机</div>
        </div>
      </Transition>
    </Tabs>
  </Card>
</template>

<style scoped>
.social-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  color: hsl(var(--muted-foreground));
  transition:
    transform 0.25s var(--ease-spring),
    color 0.2s ease,
    background-color 0.2s ease;
}
.social-btn:hover {
  color: hsl(var(--primary));
  background-color: hsl(var(--primary) / 0.12);
  transform: translateY(-2px) scale(1.12);
}
.social-btn:active {
  transform: translateY(0) scale(0.95);
}

.blog-fade-enter-active {
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}
.blog-fade-leave-active {
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}
.blog-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.blog-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
