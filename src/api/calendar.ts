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
}

/** 获取日历事件 */
export function getCalendarEvents(params?: { date?: string; type?: EventType }) {
  return api.get<CalendarEventsResponse>('/calendar/events', { params }).then((r) => r.data)
}

/** 增/改/删事件（管理员） */
export function manageEvent(action: 'add' | 'update' | 'delete', event: Partial<CalendarEvent> & { id?: string }) {
  return api.post('/calendar/events', { action, event }).then((r) => r.data)
}

/** 获取公共节假日 */
export function getHolidays(year?: number, country = 'CN') {
  return api
    .get<HolidaysResponse>('/calendar/holidays', {
      params: { year: year || new Date().getFullYear(), country },
    })
    .then((r) => r.data)
}
