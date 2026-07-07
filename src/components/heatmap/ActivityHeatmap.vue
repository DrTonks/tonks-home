<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Bot, Github } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { getAgentActivity, type AgentActivity } from '@/api/agent'
import {
  getGitHubStats,
  type ContributionDay,
  type TopLanguage,
} from '@/api/github'
import HeatmapChart from './HeatmapChart.vue'
import LanguagePie from './LanguagePie.vue'

const agentActivities = ref<AgentActivity[]>([])
const githubDays = ref<ContributionDay[]>([])
const topLanguages = ref<TopLanguage[]>([])
const totalContributions = ref(0)
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
    topLanguages.value = githubRes.value.topLanguages
    totalContributions.value = githubRes.value.totalContributions
  } else {
    githubAvailable.value = false
  }
  loading.value = false
})

const agentLegend = ['#E6F2FB', '#B3D9F0', '#7CB9E8', '#4A95CC', '#1F6FA5']
const githubLegend = ['#EEF7F2', '#C5E2D5', '#8DC4B0', '#5FA888', '#3D8068']
</script>

<template>
  <Card class="w-[clamp(320px,28vw,420px)] p-4">
    <h2
      class="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase mb-3"
    >
      最近项目活动
    </h2>

    <Tabs default-value="agent">
      <TabsList
        class="grid w-full mb-3 h-8"
        :class="githubAvailable ? 'grid-cols-2' : 'grid-cols-1'"
      >
        <TabsTrigger value="agent" class="text-[11px] gap-1">
          <Bot class="h-3 w-3" />
          Agent
        </TabsTrigger>
        <TabsTrigger v-if="githubAvailable" value="github" class="text-[11px] gap-1">
          <Github class="h-3 w-3" />
          GitHub
        </TabsTrigger>
      </TabsList>

      <!-- Agent tab -->
      <TabsContent value="agent" class="mt-0">
        <div v-if="loading">
          <Skeleton class="h-32 w-full" />
        </div>
        <template v-else>
          <div class="pt-4">
            <HeatmapChart
              mode="agent"
              :agent-activities="agentActivities"
              :github-days="[]"
            />
          </div>
          <!-- 图例 -->
          <div
            class="flex items-center justify-end gap-1 mt-1 text-[9px] text-muted-foreground"
          >
            <span>Less</span>
            <span
              v-for="(c, i) in agentLegend"
              :key="i"
              class="w-2 h-2 rounded-sm"
              :style="{ background: c }"
            />
            <span>More</span>
          </div>
        </template>
      </TabsContent>

      <!-- GitHub tab -->
      <TabsContent v-if="githubAvailable" value="github" class="mt-0">
        <div v-if="loading">
          <Skeleton class="h-32 w-full" />
        </div>
        <template v-else>
          <div class="pt-4">
            <HeatmapChart
              mode="github"
              :agent-activities="[]"
              :github-days="githubDays"
            />
          </div>
          <div
            class="flex items-center justify-end gap-1 mt-1 text-[9px] text-muted-foreground"
          >
            <span>Less</span>
            <span
              v-for="(c, i) in githubLegend"
              :key="i"
              class="w-2 h-2 rounded-sm"
              :style="{ background: c }"
            />
            <span>More</span>
          </div>
        </template>
      </TabsContent>
    </Tabs>

    <!-- 技术栈 -->
    <div
      v-if="githubAvailable && !loading"
      class="border-t border-border/40 pt-3 mt-3"
    >
      <p class="text-[10px] text-muted-foreground uppercase tracking-[0.15em] mb-2">
        技术栈
      </p>
      <LanguagePie
        :languages="topLanguages"
        :total-contributions="totalContributions"
      />
    </div>
  </Card>
</template>
