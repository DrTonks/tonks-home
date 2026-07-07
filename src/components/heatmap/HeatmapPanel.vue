<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { Bot, Github } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { getAgentActivity, type AgentActivity } from '@/api/agent'
import { getGitHubStats, type ContributionDay } from '@/api/github'
import HeatmapChart from './HeatmapChart.vue'

const agentActivities = ref<AgentActivity[]>([])
const githubDays = ref<ContributionDay[]>([])
const githubAvailable = ref(true)
const loading = ref(true)

onMounted(async () => {
  const [agentRes, githubRes] = await Promise.allSettled([
    getAgentActivity(),
    getGitHubStats(),
  ])
  if (agentRes.status === 'fulfilled' && agentRes.value.success) {
    agentActivities.value = agentRes.value.activities
  }
  if (
    githubRes.status === 'fulfilled' &&
    githubRes.value.success &&
    !githubRes.value.error
  ) {
    githubDays.value = githubRes.value.days
  } else {
    githubAvailable.value = false
  }
  loading.value = false
})

const activeTab = ref<'agent' | 'github'>('agent')
const displayTab = ref<'agent' | 'github'>('agent')
const chartVisible = ref(true)
const tabsListRef = ref<HTMLElement | null>(null)
const indicatorStyle = ref({ left: '0px', width: '0px' })

let switchTimer: ReturnType<typeof setTimeout> | null = null

function switchTab(tab: 'agent' | 'github') {
  if (tab === displayTab.value) return
  chartVisible.value = false // 淡出
  if (switchTimer) clearTimeout(switchTimer)
  switchTimer = setTimeout(() => {
    displayTab.value = tab
    chartVisible.value = true // 淡入 + 揭开
  }, 250)
}

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

watch(activeTab, (tab) => {
  updateIndicator()
  switchTab(tab)
})
onMounted(() => { updateIndicator() })

const agentLegend = ['#E6F2FB', '#B3D9F0', '#7CB9E8', '#4A95CC', '#1F6FA5']
const githubLegend = ['#EEF7F2', '#C5E2D5', '#8DC4B0', '#5FA888', '#3D8068']
</script>

<template>
  <Card class="w-[clamp(340px,26vw,460px)] p-4">
    <Tabs v-model="activeTab">
      <!-- 标题 + tab 切换同一行（带滑动指示器） -->
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-kai text-base font-medium tracking-wider text-brand-sky-deep">
          最近项目活动
        </h2>
        <div ref="tabsListRef" class="relative">
          <TabsList
            class="h-7 bg-muted/40 backdrop-blur-sm"
            :class="githubAvailable ? 'grid grid-cols-2' : 'grid-cols-1'"
          >
            <TabsTrigger value="agent" class="text-[11px] gap-1 px-2 data-[state=active]:text-primary data-[state=active]:font-semibold transition-colors duration-300">
              <Bot class="h-3 w-3" />
              Agent
            </TabsTrigger>
            <TabsTrigger v-if="githubAvailable" value="github" class="text-[11px] gap-1 px-2 data-[state=active]:text-primary data-[state=active]:font-semibold transition-colors duration-300">
              <Github class="h-3 w-3" />
              GitHub
            </TabsTrigger>
          </TabsList>
          <!-- 玻璃滑动指示器 -->
          <div
            class="absolute bottom-0 h-0.5 bg-primary/80 rounded-full transition-all duration-300 ease-out"
            :style="{ left: indicatorStyle.left, width: indicatorStyle.width }"
          />
        </div>
      </div>

      <TabsContent value="agent" class="mt-0" />
      <TabsContent v-if="githubAvailable" value="github" class="mt-0" />

      <!-- 图表区（手动 class 控制淡入淡出） -->
      <div v-if="loading" class="pt-4">
        <Skeleton class="h-44 w-full" />
      </div>
      <div v-else class="pt-4">
        <div :class="['chart-stage', { 'chart-hidden': !chartVisible }]">
          <HeatmapChart
            :key="displayTab"
            :mode="displayTab"
            :agent-activities="displayTab === 'agent' ? agentActivities : []"
            :github-days="displayTab === 'github' ? githubDays : []"
          />
        </div>
        <div class="flex items-center justify-end gap-1 mt-1 text-[9px] text-muted-foreground">
          <span>Less</span>
          <span v-for="(c, i) in (displayTab === 'agent' ? agentLegend : githubLegend)" :key="i" class="w-2.5 h-2.5 rounded-sm" :style="{ background: c }" />
          <span>More</span>
        </div>
      </div>
    </Tabs>
  </Card>
</template>

<style scoped>
/* 手动 class 控制淡入淡出 */
.chart-stage {
  opacity: 1;
  transition: opacity 0.25s ease-in;
}
.chart-stage.chart-hidden {
  opacity: 0;
}
</style>
