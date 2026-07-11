<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Bot, Github } from 'lucide-vue-next'
import { ElSelect, ElOption } from 'element-plus'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/option/style/css'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { getAgentActivity, type AgentActivity } from '@/api/agent'
import { getGitHubStats, type ContributionDay } from '@/api/github'
import HeatmapChart from './HeatmapChart.vue'
import { useThemeStore } from '@/stores/theme'

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
const timeRange = ref<3 | 6 | 12>(3)  // 月份
const indicatorStyle = ref({ left: '0%', width: '50%' })

// 根据时间范围过滤数据
function filterByMonths<T extends { date: string }>(items: T[], months: number): T[] {
  if (!items.length) return items
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - months)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return items.filter((it) => it.date >= cutoffStr)
}

const filteredAgent = computed(() => filterByMonths(agentActivities.value, timeRange.value))
const filteredGithub = computed(() => filterByMonths(githubDays.value, timeRange.value))

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
  if (!githubAvailable.value) {
    indicatorStyle.value = { left: '0%', width: '100%' }
  } else {
    const isAgent = activeTab.value === 'agent'
    indicatorStyle.value = {
      left: isAgent ? '0%' : '50%',
      width: '50%',
    }
  }
}

watch(activeTab, (tab) => {
  updateIndicator()
  switchTab(tab)
})
onMounted(() => { updateIndicator() })

const theme = useThemeStore()
const legend = computed(() => {
  const dark = theme.isDark
  if (displayTab.value === 'agent') {
    return dark
      ? ['#3a4656', '#0e3a5c', '#1a5c8c', '#2f86c2', '#5aa8dd']
      : ['#E6F2FB', '#B3D9F0', '#7CB9E8', '#4A95CC', '#1F6FA5']
  }
  return dark
    ? ['#3a4656', '#0e4429', '#006d32', '#26a641', '#39d353']
    : ['#EEF7F2', '#C5E2D5', '#8DC4B0', '#5FA888', '#3D8068']
})
</script>

<template>
  <Card class="w-[clamp(340px,26vw,460px)] p-4 !overflow-visible">
    <Tabs v-model="activeTab">
      <!-- 标题 + tab 切换同一行（带滑动指示器） -->
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-kai text-base font-medium tracking-wider text-brand-sky-deep">
          近期项目活动
        </h2>
        <div class="flex items-center gap-2">
          <!-- Element Plus 下拉框 -->
          <el-select
            v-model="timeRange"
            size="small"
            class="time-select"
            popper-class="time-popper"
          >
            <el-option :value="3" label="近 3 月" />
            <el-option :value="6" label="近 6 月" />
            <el-option :value="12" label="近一年" />
          </el-select>
          <div class="relative">
          <TabsList
            class="h-7 content-center bg-muted backdrop-blur-sm"
            :class="githubAvailable ? 'grid grid-cols-2' : 'grid-cols-1'"
          >
            <TabsTrigger value="agent" class="text-[11px] leading-none gap-1 px-2 data-[state=active]:text-primary data-[state=active]:font-semibold transition-colors duration-300">
              <Bot class="h-3 w-3" />
              Agent
            </TabsTrigger>
            <TabsTrigger v-if="githubAvailable" value="github" class="text-[11px] leading-none gap-1 px-2 data-[state=active]:text-primary data-[state=active]:font-semibold transition-colors duration-300">
              <Github class="h-3 w-3" />
              GitHub
            </TabsTrigger>
          </TabsList>
          <!-- 玻璃滑动指示器（仅亮色显示）-->
          <div
            v-if="!theme.isDark"
            class="absolute bottom-0 h-0.5 bg-primary/80 rounded-full transition-all duration-300 ease-out"
            :style="{ left: indicatorStyle.left, width: indicatorStyle.width }"
          />
        </div>
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
            :agent-activities="displayTab === 'agent' ? filteredAgent : []"
            :github-days="displayTab === 'github' ? filteredGithub : []"
          />
        </div>
        <div class="flex items-center justify-end gap-1 mt-1 text-[9px] text-muted-foreground">
          <span>Less</span>
          <span v-for="(c, i) in legend" :key="i" class="w-2.5 h-2.5 rounded-sm" :style="{ background: c }" />
          <span>More</span>
        </div>
      </div>
    </Tabs>
  </Card>
</template>

<style scoped>
/* el-select 主题适配 */
.time-select {
  --el-fill-color-blank: transparent;
  --el-border-color: rgba(255,255,255,0.25);
  --el-text-color-regular: hsl(var(--muted-foreground));
  --el-border-radius-base: 8px;
  width: 80px;
}
.time-select :deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(8px);
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  padding: 0 8px;
  transition: all 0.2s;
}
.time-select :deep(.el-input__wrapper:hover) {
  background: rgba(255,255,255,0.3);
  border-color: hsl(var(--primary) / 0.4);
}
.time-select :deep(.el-input__inner) {
  font-size: 10px;
}

/* 手动 class 控制淡入淡出 */
.chart-stage {
  opacity: 1;
  transition: opacity 0.25s ease-in;
}
.chart-stage.chart-hidden {
  opacity: 0;
}
</style>
