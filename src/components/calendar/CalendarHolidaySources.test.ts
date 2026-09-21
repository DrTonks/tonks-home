import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent } from 'vue'
import { renderToString } from 'vue/server-renderer'
import CalendarMonth from './CalendarMonth.vue'
import CalendarWidget from './CalendarWidget.vue'

const fixtures = vi.hoisted(() => {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return {
    publicHolidays: [
      { date: `${month}-01`, name: '公共假期', isOffDay: true },
      { date: `${month}-02`, name: '公共假期', isOffDay: true },
    ],
    customHolidays: [
      { id: 'anniversary', date: `${month}-01`, name: '个人纪念日', type: 'holiday' },
      { id: 'birthday', date: `${month}-15`, name: '生日', type: 'holiday' },
    ],
    gridProps: {} as Record<string, unknown>,
  }
})

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => ({
    publicHolidays: fixtures.publicHolidays,
    customHolidays: fixtures.customHolidays,
    events: fixtures.customHolidays,
    workdays: [],
    holidayStatus: 'available',
  }),
}))
vi.mock('./CalendarGrid.vue', () => ({
  default: defineComponent({
    props: ['holidays', 'events'],
    setup(props) {
      fixtures.gridProps = { holidays: props.holidays, events: props.events }
      return () => null
    },
  }),
}))
vi.mock('./CalendarDayDialog.vue', () => ({ default: defineComponent({ setup: () => () => null }) }))

describe('calendar public holidays and personal events', () => {
  for (const [name, component] of [['month', CalendarMonth], ['widget', CalendarWidget]] as const) {
    it(`${name} keeps personal holidays out of rest-day ranges while preserving event dots`, async () => {
      await renderToString(createSSRApp(component))
      expect(fixtures.gridProps.holidays).toEqual(fixtures.publicHolidays)
      expect(fixtures.gridProps.events).toEqual(fixtures.customHolidays)
    })
  }
})
