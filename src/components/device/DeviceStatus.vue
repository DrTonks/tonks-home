<script setup lang="ts">
import { computed } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDevicePoll } from '@/composables/useDevicePoll'
import { formatTimestamp, timeAgo, cn } from '@/lib/utils'
import StatusDot from './StatusDot.vue'

const { isRefreshing, refresh, store } = useDevicePoll()

// 状态色映射
const colorMap: Record<string, string> = {
  awake: 'hsl(var(--primary))',
  sleeping: 'hsl(var(--color-silver))',
  unknown: 'hsl(var(--color-amber))',
  error: 'hsl(var(--color-red))',
}

// 应用名 → 描述映射
const appDescMap: Record<string, string> = {
  'Electron应用开发': '在开发exe应用中...很可能是综设任务！',
  '操作菜单': '在查看电脑菜单',
  '系统设置': '在编辑系统配置？',
  '记事本': '可能在修改什么配置文件...',
  '打开方式': '在选择用什么软件打开文件',
  'Microsoft Store': '在浏览应用商店',
  '开始菜单': '在查找什么文件？',
  'FileZilla': '正在管理服务器文件，可能是在更新网站。',
  '睡眠状态': '电脑处于睡眠状态，人也可能处于睡眠状态',
  '锁屏': '暂时离开',
  '电脑-手机助手': '正在看手机？',
  '照片查看器': '浏览照片中...',
  '关机中': '电脑关机了，也许是似了。',
  "Terminal":"很有可能在Vibe coding",
  '命令提示符': '命令行操作中！',
  '视频': '在看视频~',
  'Word 文档': '正在编辑Word文档，可能在赶报告？',
  'Excel表格': '正在成为数据分析师！',
  'PPT演示文稿': '可能在看课件，也可能在学习制作PPT',
  'OneNote': '笔记时间',
  'Typora编辑器': '正在编辑Markdown文件，可能在整理笔记！',
  'Edge浏览器': '查询资料中...大概率在逛b站？',
  'VSCode 编辑器': '正在写代码！也可能在看AI写代码。',
  'Clash': '正在科学上网...',
  '任务管理器': '在查看资源占用情况...',
  'Steam': '正在查看Steam中...',
  '微信': '与朋友畅聊中...',
  'QQ': 'QQ在线中（也可能睡着了）',
  '文件资源管理器': '在整理电脑文件...',
  'XMind思维导图': '头脑风暴...',
  'WPS办公': 'WPS办公，效率工具。',
  'WPS PDF': '阅读或编辑PDF文档',
  'WPS文字': '文字编辑',
  'WPS演示': '演示文稿',
  'WPS表格': '表格处理',
  '百度网盘': '龟速下载文件中...',
  'OneDrive': '龟速浏览共享文档中...',
  'Postman': 'API测试中...',
  'GitHub Desktop': '正在使用GitHub...',
  'OBS Studio': '录屏中...',
  '似了': '睡似了或不在线，紧急请电话联系。',
}

interface DisplayState {
  key: string
  color: string
  appName: string
  desc: string
  pulse: boolean
}

const currentState = computed<DisplayState>(() => {
  // 错误态
  if (store.error) {
    return {
      key: 'error',
      color: colorMap.error,
      appName: '服务器离线',
      desc: '无法连接到后端服务，可能是网络问题或服务器维护中。',
      pulse: true,
    }
  }
  // 未加载
  if (!store.currentStatus) {
    return {
      key: 'unknown',
      color: colorMap.unknown,
      appName: '加载中…',
      desc: '正在获取最新状态。',
      pulse: false,
    }
  }
  const s = store.currentStatus
  // status=99 或 info 没有 desc 字段 → 未登记
  if (
    s.status === 99 ||
    !s.info ||
    typeof s.info === 'object' && !('desc' in s.info)
  ) {
    return {
      key: 'unknown',
      color: colorMap.unknown,
      appName: '未登记应用',
      desc: '当前使用的应用未在状态列表中登记。',
      pulse: true,
    }
  }
  const info = s.info as { id: number; name: string; desc: string; color: string }
  // 应用名不在映射表中且为 awake → 视为未登记（如 raw exe 文件名漏过 report_app 的映射）
  if (!appDescMap[info.name] && info.color !== 'sleeping') {
    return {
      key: 'unknown',
      color: colorMap.unknown,
      appName: '未登记应用',
      desc: `正在使用的应用未在状态列表中登记，也许是什么游戏？`,
      pulse: true,
    }
  }
  const colorKey = info.name === '关机中' ? 'error' : (info.color || 'awake')
  const desc = appDescMap[info.name] || info.name + '：' + info.desc
  return {
    key: colorKey,
    color: colorMap[colorKey] || colorMap.awake,
    appName: info.name,
    desc,
    pulse: colorKey !== 'sleeping',
  }
})

const timestamp = computed(() => store.currentStatus?.timestamp ?? null)
const relativeTime = computed(() => (timestamp.value ? timeAgo(timestamp.value) : ''))
const absoluteTime = computed(() => (timestamp.value ? formatTimestamp(timestamp.value) : '未知'))
</script>

<template>
  <Card class="w-[clamp(220px,18vw,280px)] p-5 relative group">
    <!-- 标题 + 刷新按钮 -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-kai text-base font-medium tracking-wider text-brand-sky-deep">
        在干什么？
      </h2>
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="isRefreshing"
        class="opacity-50 group-hover:opacity-100 transition-opacity h-7 w-7"
        aria-label="刷新状态"
        @click="refresh"
      >
        <RefreshCw :class="cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')" />
      </Button>
    </div>

    <!-- 状态点 + 应用名 -->
    <div class="flex items-center gap-2.5 mb-3 justify-center sm:justify-start">
      <StatusDot :color="currentState.color" :pulse="currentState.pulse" />
      <span
        class="font-heavy text-xl font-bold tracking-tight transition-colors duration-normal"
        :style="{ color: currentState.color }"
      >
        {{ currentState.appName }}
      </span>
    </div>

    <!-- 描述 -->
    <p class="text-[13px] leading-relaxed text-muted-foreground line-clamp-2 mb-4 min-h-[2.6em] text-center sm:text-left">
      {{ currentState.desc }}
    </p>

    <!-- 时间 -->
    <div
      class="text-[11px] text-muted-foreground/70 tabular-nums flex items-center gap-1.5"
    >
      <span v-if="relativeTime">{{ relativeTime }} ·</span>
      <span>{{ absoluteTime }}</span>
    </div>
  </Card>
</template>
