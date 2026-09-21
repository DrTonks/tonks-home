import type { Holiday } from '@/api/calendar'

export interface HolidayRange { name: string; start: string; end: string }
export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Group actual off-day records, never treating make-up working days as holidays. */
export function holidayRanges(days: Holiday[]): HolidayRange[] {
  const sorted = [...new Map(days.filter(d => d.isOffDay !== false).map(d => [d.date, d])).values()].sort((a,b) => a.date.localeCompare(b.date))
  const ranges: HolidayRange[] = []
  for (const day of sorted) {
    const previous = ranges[ranges.length - 1]
    if (previous && previous.name === day.name && shiftDate(previous.end, 1) === day.date) previous.end = day.date
    else ranges.push({name:day.name, start:day.date, end:day.date})
  }
  return ranges
}
export function getDayOfHoliday(date: string, range: HolidayRange): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) / 86400000) + 1
}
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
}
