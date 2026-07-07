import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getQuery, getStatusList, getOnlineCount, type StatusInfo, type QueryResponse } from '@/api/device'

export const useDeviceStore = defineStore('device', () => {
  const currentStatus = ref<QueryResponse | null>(null)
  const statusList = ref<StatusInfo[]>([])
  const onlineCount = ref<{ online_count: number; mobile_count: number } | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchQuery() {
    loading.value = true
    error.value = null
    try {
      currentStatus.value = await getQuery()
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function fetchStatusList() {
    try {
      statusList.value = await getStatusList()
    } catch (e: any) {
      console.error('fetchStatusList failed:', e)
    }
  }

  async function fetchOnlineCount() {
    try {
      onlineCount.value = await getOnlineCount()
    } catch (e: any) {
      console.error('fetchOnlineCount failed:', e)
    }
  }

  async function fetchAll() {
    await Promise.all([fetchQuery(), fetchStatusList(), fetchOnlineCount()])
  }

  return {
    currentStatus,
    statusList,
    onlineCount,
    loading,
    error,
    fetchQuery,
    fetchStatusList,
    fetchOnlineCount,
    fetchAll,
  }
})
