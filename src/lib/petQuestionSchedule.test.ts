import { describe, expect, it } from 'vitest'
import {
  canShowForSchedule,
  localDayKey,
  localWeekKey,
  periodKey,
  recordShown,
  type QuestionSchedule,
} from './petQuestionSchedule'

describe('pet question natural calendar schedule', () => {
  const daily: QuestionSchedule = { mode: 'daily', limit: 2 }
  const weekly: QuestionSchedule = { mode: 'weekly', limit: 1 }

  it('resets at local midnight rather than after 24 hours', () => {
    const late = new Date(2026, 7, 8, 23, 59)
    const morning = new Date(2026, 7, 9, 7, 0)
    const first = recordShown(undefined, daily, late)
    const second = recordShown(first, daily, late)
    expect(canShowForSchedule(second, daily, late)).toBe(false)
    expect(canShowForSchedule(second, daily, morning)).toBe(true)
    expect(localDayKey(morning)).toBe('2026-08-09')
  })

  it('uses Monday as the beginning of a natural week', () => {
    const sunday = new Date(2026, 7, 9, 20, 0)
    const monday = new Date(2026, 7, 10, 8, 0)
    expect(localWeekKey(sunday)).toBe('2026-08-03')
    expect(localWeekKey(monday)).toBe('2026-08-10')
    const shown = recordShown(undefined, weekly, sunday)
    expect(canShowForSchedule(shown, weekly, sunday)).toBe(false)
    expect(canShowForSchedule(shown, weekly, monday)).toBe(true)
  })

  it('increments within a period and drops the previous period count', () => {
    const dayOne = new Date(2026, 7, 8, 12, 0)
    const dayTwo = new Date(2026, 7, 9, 12, 0)
    const first = recordShown(undefined, daily, dayOne)
    const second = recordShown(first, daily, dayOne)
    const reset = recordShown(second, daily, dayTwo)
    expect(second.shown_count).toBe(2)
    expect(reset.shown_count).toBe(1)
    expect(reset.period).toBe(periodKey(daily, dayTwo))
  })

  it('treats a dismissed question as shown for this period, then allows the next period', () => {
    const rejectedAt = new Date(2026, 7, 8, 9, 0)
    const sameDay = new Date(2026, 7, 8, 20, 0)
    const nextDay = new Date(2026, 7, 9, 7, 0)
    const shownBeforeReject = recordShown(undefined, { mode: 'daily', limit: 1 }, rejectedAt)

    expect(canShowForSchedule(shownBeforeReject, { mode: 'daily', limit: 1 }, sameDay)).toBe(
      false,
    )
    expect(canShowForSchedule(shownBeforeReject, { mode: 'daily', limit: 1 }, nextDay)).toBe(true)
  })
})
