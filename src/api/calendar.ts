import { api } from './index'

export type EventType = 'personal' | 'work' | 'holiday'

export interface CalendarEvent {
  id: string
  date: string
  name: string
  type: EventType
}

export interface Holiday {
  date: string
  name: string
  countryCode?: string
  isOffDay?: boolean
  inferredWeekend?: boolean
}

export interface CalendarEventsResponse {
  success: boolean
  events: CalendarEvent[]
}

export interface HolidaysResponse {
  success: boolean
  year: number
  country: string
  publicHolidays: Holiday[]
  customHolidays: CalendarEvent[]
  workdays?: Holiday[]
  holidayStatus?: 'available' | 'unpublished' | 'unavailable'
  holidayStale?: boolean
}

/** 获取日历事件 */
export function getCalendarEvents(params?: { date?: string; type?: EventType }) {
  return api.get<CalendarEventsResponse>('/calendar/events', { params }).then((r) => r.data)
}

/** 增/改/删事件（管理员） */
export function manageEvent(action: 'add' | 'update' | 'delete', event: Partial<CalendarEvent> & { id?: string }) {
  return api.post('/calendar/events', { action, event }).then((r) => r.data)
}

/** Coalesce simultaneous month/upcoming requests; keep custom events fresh. */
const holidayRequests = new Map<string, Promise<HolidaysResponse>>()
export function getHolidays(year = new Date().getFullYear(), country = 'CN') {
  const key = `${country}:${year}`
  const pending = holidayRequests.get(key)
  if (pending) return pending
  const request = api.get<HolidaysResponse>('/calendar/holidays', {params: {year, country}})
    .then(r => r.data).finally(() => holidayRequests.delete(key))
  holidayRequests.set(key, request)
  return request
}
