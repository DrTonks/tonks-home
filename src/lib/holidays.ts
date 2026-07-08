/**
 * 中国多日节假日范围（2026年）
 * 延长单日 API 数据为连续多日滑块
 */
export interface HolidayRange {
  name: string
  start: string  // YYYY-MM-DD
  end: string
}

export const MULTI_DAY_RANGES: HolidayRange[] = [
  { name: '元旦', start: '2026-01-01', end: '2026-01-03' },
  { name: '春节', start: '2026-02-17', end: '2026-02-23' },
  { name: '清明节', start: '2026-04-05', end: '2026-04-07' },
  { name: '劳动节', start: '2026-05-01', end: '2026-05-05' },
  { name: '端午节', start: '2026-06-19', end: '2026-06-21' },
  { name: '中秋节', start: '2026-09-25', end: '2026-09-27' },
  { name: '国庆节', start: '2026-10-01', end: '2026-10-07' },
]

/** 获取某日期匹配的多日节日信息，null = 不在任何多日范围 */
export function getMultiDayHoliday(date: string): HolidayRange | null {
  return MULTI_DAY_RANGES.find((r) => date >= r.start && date <= r.end) ?? null
}

/** 获取日期在该节日中的第几天（1-based） */
export function getDayOfHoliday(date: string, range: HolidayRange): number {
  return Math.floor((new Date(date).getTime() - new Date(range.start).getTime()) / 86400000) + 1
}
