/**
 * ECharts 延迟初始化模块
 *
 * 将 ECharts 的 use() 注册从 main.ts 移出，
 * 仅在 heatmap 组件首次渲染时才加载 echarts chunk，
 * 避免阻塞首屏 LoadingScreen 的渲染。
 */
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { HeatmapChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  LegendComponent,
  TitleComponent,
  CalendarComponent,
} from 'echarts/components'

let initialized = false

export function initECharts() {
  if (initialized) return
  use([
    CanvasRenderer,
    HeatmapChart,
    PieChart,
    GridComponent,
    TooltipComponent,
    VisualMapComponent,
    LegendComponent,
    TitleComponent,
    CalendarComponent,
  ])
  initialized = true
}
