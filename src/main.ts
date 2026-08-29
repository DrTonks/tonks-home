import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './routes'
import { api } from './api'
import { recordSiteVisit } from './lib/site-visits'
import { installVisibilityTitle } from './lib/visibility-title'
import { setupMock } from './mock'
import './styles/index.css'

// 启用 Mock（VITE_MOCK=true 时生效）
setupMock(api)
installVisibilityTitle()
void recordSiteVisit().catch((error) => {
  console.warn('[site visits] failed to record visit', error)
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
