import { describe, it, expect } from 'vitest'
import { holidayRanges, daysUntil, shiftDate } from './holidays'

describe('holiday data derived calendar', () => {
  it('groups contiguous days once and excludes make-up workdays', () => {
    expect(holidayRanges([
      {date:'2026-10-02',name:'国庆节',isOffDay:true},
      {date:'2026-10-01',name:'国庆节',isOffDay:true},
      {date:'2026-10-02',name:'国庆节',isOffDay:true},
      {date:'2026-10-03',name:'国庆节',isOffDay:false},
      {date:'2026-10-04',name:'国庆节',isOffDay:true},
    ])).toEqual([{name:'国庆节',start:'2026-10-01',end:'2026-10-02'},{name:'国庆节',start:'2026-10-04',end:'2026-10-04'}])
  })
  it('keeps adjacent different holidays separate', () => {
    expect(holidayRanges([{date:'2026-10-01',name:'A'},{date:'2026-10-02',name:'B'}])).toHaveLength(2)
  })
  it('handles leap days, year boundaries and date-only countdowns', () => {
    expect(shiftDate('2028-02-28',1)).toBe('2028-02-29')
    expect(shiftDate('2026-12-31',1)).toBe('2027-01-01')
    expect(daysUntil('2027-01-01','2026-12-31')).toBe(1)
    expect(daysUntil('2026-09-20','2026-09-20')).toBe(0)
  })
})
