<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { FolderGit2, History, FileText } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { getBlogPosts, type BlogPostsResponse } from '@/api/blog'
import ProjectCard from './ProjectCard.vue'
import TimelineCard from './TimelineCard.vue'
import ArticleList from './ArticleList.vue'

const data = ref<BlogPostsResponse | null>(null)
const loading = ref(true)
const activeTab = ref('article')
const tabsListRef = ref<HTMLElement | null>(null)
const indicatorStyle = ref({ left: '0px', width: '0px' })

function updateIndicator() {
  nextTick(() => {
    const list = tabsListRef.value
    if (!list) return
    const active = list.querySelector('[data-state="active"]') as HTMLElement
    if (!active) return
    const listRect = list.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    indicatorStyle.value = {
      left: `${activeRect.left - listRect.left}px`,
      width: `${activeRect.width}px`,
    }
  })
}

watch(activeTab, updateIndicator)

onMounted(async () => {
  try {
    data.value = await getBlogPosts(3)
  } catch (e) {
    console.error('fetchBlogPosts failed:', e)
  } finally {
    loading.value = false
  }
  updateIndicator()
})
</script>

<template>
  <Card class="w-[clamp(280px,24vw,360px)] p-4">
    <h2 class="font-kai text-base font-medium tracking-wider text-brand-sky-deep mb-3">
      我的最新动态！
    </h2>

    <Tabs v-model="activeTab">
      <!-- 带滑动指示器的导航栏 -->
      <div ref="tabsListRef" class="relative mb-3">
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
        <!-- 滑动玻璃指示器 -->
        <div
          class="absolute bottom-0 h-0.5 bg-primary/80 rounded-full transition-all duration-300 ease-out"
          :style="{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }"
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
