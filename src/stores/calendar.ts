import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getCalendarEvents,
  getHolidays,
  manageEvent,
  type CalendarEvent,
  type Holiday,
  type EventType,
} from '@/api/calendar'

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const publicHolidays = ref<Holiday[]>([])
  const customHolidays = ref<CalendarEvent[]>([])
  const loading = ref(false)
  const workdays = ref<Holiday[]>([])
  const holidayStatus = ref('')
  let holidayRequest = 0
  let eventRequest = 0

  async function fetchEvents(params?: { date?: string; type?: EventType }) {
    const request = ++eventRequest
    loading.value = true
    try {
      const res = await getCalendarEvents(params)
      if (res.success && request === eventRequest) events.value = res.events
    } finally {
      if (request === eventRequest) loading.value = false
    }
  }

  async function fetchHolidays(year?: number) {
    const request = ++holidayRequest
    publicHolidays.value = []
    customHolidays.value = []
    workdays.value = []
    holidayStatus.value = ''
    try {
      const res = await getHolidays(year)
      if (res.success && request === holidayRequest) {
        workdays.value = res.workdays || []
        holidayStatus.value = res.holidayStatus || 'available'
        publicHolidays.value = res.publicHolidays
        customHolidays.value = res.customHolidays
      }
    } catch (e) {
      if (request === holidayRequest) holidayStatus.value = 'unavailable'
      console.error('fetchHolidays failed:', e)
    }
  }

  async function addEvent(event: { date: string; name: string; type?: EventType }) {
    const res = await manageEvent('add', event)
    if (res.success) {
      // 重新拉取当前月份的事件
      await refetchCurrentMonth()
    }
    return res
  }

  async function updateEvent(id: string, changes: Partial<CalendarEvent>) {
    const res = await manageEvent('update', { id, ...changes })
    if (res.success) {
      await refetchCurrentMonth()
    }
    return res
  }

  async function deleteEvent(id: string) {
    const res = await manageEvent('delete', { id })
    if (res.success) {
      events.value = events.value.filter((e) => e.id !== id)
      await refetchCurrentMonth()
    }
    return res
  }

  // 内部：重新拉取当前显示月份的事件（保持事件参数同步）
  async function refetchCurrentMonth() {
    // 根据当前 events 推断月份范围 — 简化：直接全量拉
    const res = await getCalendarEvents()
    if (res.success) events.value = res.events
  }

  return {
    events,
    publicHolidays,
    workdays,
    holidayStatus,
    customHolidays,
    loading,
    fetchEvents,
    fetchHolidays,
    addEvent,
    updateEvent,
    deleteEvent,
  }
})
