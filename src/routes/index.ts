import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...(import.meta.env.DEV ? [{
      path: '/__design/pet-reactions/', name: 'pet-reactions-preview',
      component: () => import('@/views/dev/PetReactionsPreview.vue'),
    }] : []),
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach(to => {
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.append(robots) }
  robots.content = to.name === 'home' ? 'index, follow' : 'noindex, follow'
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (canonical) canonical.href = to.name === 'home' ? 'https://tonks.top/' : new URL(to.path, 'https://tonks.top/').href
})

export default router
