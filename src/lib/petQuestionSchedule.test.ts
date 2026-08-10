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

  // ===== interval 模式测试 =====

  it('resets after intervalDays days from epoch boundary', () => {
    // intervalDays=2 → 每 2 个本地日历天一个窗口
    // 2026-08-09 CST → 窗口起始 2026-08-07 UTC
    // 2026-08-11 CST → 窗口起始 2026-08-09 UTC（新窗口）
    const dayInWindow = new Date(2026, 7, 9, 12, 0)   // 2026-08-09
    const nextWindow = new Date(2026, 7, 11, 0, 0)     // 2026-08-11（跨入下一窗口）
    const interval2: QuestionSchedule = { mode: 'interval', intervalDays: 2, limit: 1 }

    const shown = recordShown(undefined, interval2, dayInWindow)
    expect(canShowForSchedule(shown, interval2, dayInWindow)).toBe(false)
    expect(canShowForSchedule(shown, interval2, nextWindow)).toBe(true)
  })

  it('generates correct periodKey for interval schedules', () => {
    const schedule: QuestionSchedule = { mode: 'interval', intervalDays: 3, limit: 1 }
    const date = new Date(2026, 7, 10, 14, 0) // 2026-08-10
    const key = periodKey(schedule, date)
    // epochDay=20674, 20674/3=6891*3=20673=2026-08-08 UTC
    expect(key).toBe('interval:3d:2026-08-08')
  })

  it('supports limit > 1 within the same interval period', () => {
    const interval2: QuestionSchedule = { mode: 'interval', intervalDays: 2, limit: 2 }
    const date = new Date(2026, 7, 9, 12, 0)
    const first = recordShown(undefined, interval2, date)
    expect(canShowForSchedule(first, interval2, date)).toBe(true)
    const second = recordShown(first, interval2, date)
    expect(canShowForSchedule(second, interval2, date)).toBe(false)
  })

  it('resets count when entering a new interval period', () => {
    const interval3: QuestionSchedule = { mode: 'interval', intervalDays: 3, limit: 1 }
    // 2026-08-09 CST → epochDay 20673, window 20673-20675
    // 2026-08-12 CST → epochDay 20676, window 20676-20678（新窗口）
    const window1 = new Date(2026, 7, 9, 12, 0)  // 2026-08-09
    const window2 = new Date(2026, 7, 12, 12, 0)  // 2026-08-12
    const first = recordShown(undefined, interval3, window1)
    expect(first.period).toBe(periodKey(interval3, window1))
    const second = recordShown(first, interval3, window2)
    expect(second.shown_count).toBe(1)
    expect(second.period).toBe(periodKey(interval3, window2))
    expect(second.period).not.toBe(first.period)
  })
})
