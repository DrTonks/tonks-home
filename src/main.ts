import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './routes'
import { api } from './api'
import { recordSiteVisit } from './lib/site-visits'
import { installVisibilityTitle } from './lib/visibility-title'
import { installAgentTools } from './lib/agent-tools'
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
// On an Apache error document, keep the dark fallback until the original
// missing URL has resolved, avoiding the homepage loading/welcome screens.
if (document.querySelector('meta[name="tonks-error-page"]')) {
  void router.isReady().then(() => app.mount('#app'))
} else {
  app.mount('#app')
  document.dispatchEvent(new Event('tonks:app-mounted'))
}
void installAgentTools()
