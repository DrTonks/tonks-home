import { createApp } from 'vue'
import { createPinia } from 'pinia'
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
import App from './App.vue'
import router from './routes'
import { api } from './api'
import { setupMock } from './mock'
import './styles/index.css'

// ECharts 按需注册
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

// 启用 Mock（VITE_MOCK=true 时生效）
setupMock(api)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
