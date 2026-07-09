import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './routes'
import { api } from './api'
import { setupMock } from './mock'
import './styles/index.css'

// 启用 Mock（VITE_MOCK=true 时生效）
setupMock(api)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
