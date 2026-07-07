import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useDeviceStore } from '@/stores/device'

/**
 * 设备状态轮询
 * - 正常态：30s 一次
 * - 网络失败：退避到 60s
 * - 组件卸载时清理 interval
 * - 暴露 isRefreshing 用于按钮 loading 态
 */
export function useDevicePoll(normalInterval = 30_000, backoffInterval = 60_000) {
  const store = useDeviceStore()
  const isRefreshing = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    if (isRefreshing.value) return
    isRefreshing.value = true
    try {
      await store.fetchQuery()
    } finally {
      isRefreshing.value = false
    }
    // 根据是否有错误调整下次轮询间隔
    schedule(store.error ? backoffInterval : normalInterval)
  }

  function schedule(interval: number) {
    if (timer) clearInterval(timer)
    timer = setInterval(refresh, interval)
  }

  onMounted(() => {
    refresh()
  })

  onBeforeUnmount(() => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  })

  return { isRefreshing, refresh, store }
}
