export type QuestionSchedule =
  | { mode: 'once'; limit?: never }
  | { mode: 'daily' | 'weekly'; limit: number }
  | { mode: 'interval'; intervalDays: number; limit: number }

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

function localIntervalKey(intervalDays: number, date = new Date()): string {
  // 以本地日期 00:00 为基准，确保同日不同时刻属于同一周期
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const epochDays = Math.floor(localMidnight.getTime() / 86_400_000)
  const periodStart = Math.floor(epochDays / intervalDays) * intervalDays
  const periodDate = new Date(periodStart * 86_400_000)
  // UTC getter 避免时区偏移导致日期显示偏移
  return `${periodDate.getUTCFullYear()}-${pad(periodDate.getUTCMonth() + 1)}-${pad(periodDate.getUTCDate())}`
}

export function periodKey(schedule: QuestionSchedule, date = new Date()): string {
  if (schedule.mode === 'daily') return `day:${localDayKey(date)}`
  if (schedule.mode === 'weekly') return `week:${localWeekKey(date)}`
  if (schedule.mode === 'interval') return `interval:${schedule.intervalDays}d:${localIntervalKey(schedule.intervalDays, date)}`
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
