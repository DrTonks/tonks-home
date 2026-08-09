export type QuestionSchedule =
  { mode: 'once'; limit?: never } | { mode: 'daily' | 'weekly'; limit: number }

export interface QuestionActivityEntry {
  period: string
  shown_count: number
  last_shown_at: string
  answered_at?: string
}

export type QuestionActivity = Record<string, QuestionActivityEntry>

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function localDayKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function localWeekKey(date = new Date()): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
}

export function periodKey(schedule: QuestionSchedule, date = new Date()): string {
  if (schedule.mode === 'daily') return `day:${localDayKey(date)}`
  if (schedule.mode === 'weekly') return `week:${localWeekKey(date)}`
  return 'once'
}

export function canShowForSchedule(
  entry: QuestionActivityEntry | undefined,
  schedule: QuestionSchedule,
  date = new Date(),
): boolean {
  if (!entry) return true
  if (schedule.mode === 'once') return false
  const currentPeriod = periodKey(schedule, date)
  if (entry.period !== currentPeriod) return true
  return entry.shown_count < schedule.limit
}

export function recordShown(
  entry: QuestionActivityEntry | undefined,
  schedule: QuestionSchedule,
  date = new Date(),
): QuestionActivityEntry {
  const period = periodKey(schedule, date)
  const shownCount = entry?.period === period ? entry.shown_count + 1 : 1
  return {
    period,
    shown_count: shownCount,
    last_shown_at: date.toISOString(),
    ...(entry?.answered_at ? { answered_at: entry.answered_at } : {}),
  }
}
