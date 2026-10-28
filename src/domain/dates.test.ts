import { describe, expect, it } from 'vitest'
import { addDays, dateRange, daysBetween, formatShort, recurringDates, startOfWeek, today, weekdayIndex } from './dates'

describe('dates', () => {
  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-02', -7)).toBe('2026-10-26')
  })

  it('counts days between dates', () => {
    expect(daysBetween('2026-11-01', '2026-11-15')).toBe(14)
    expect(daysBetween('2026-11-15', '2026-11-01')).toBe(-14)
  })

  it('finds weekdays and week starts (Monday)', () => {
    expect(weekdayIndex('2026-11-02')).toBe(0) // Monday
    expect(weekdayIndex('2026-11-01')).toBe(6) // Sunday
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26')
    expect(startOfWeek('2026-11-04')).toBe('2026-11-02')
  })

  it('builds inclusive ranges', () => {
    expect(dateRange('2026-11-02', '2026-11-04')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
  })

  it('formats short labels', () => {
    expect(formatShort('2026-11-02')).toBe('Mon 2 Nov')
  })

  it('uses the local calendar date for today', () => {
    expect(today(new Date(2026, 10, 2, 23, 30))).toBe('2026-11-02')
  })

  it('expands recurring schedules from anchors before, inside and after the range', () => {
    expect(recurringDates('2026-10-03', 14, '2026-11-01', '2026-11-30')).toEqual(['2026-11-14', '2026-11-28'])
    expect(recurringDates('2026-11-14', 14, '2026-11-01', '2026-11-30')).toEqual(['2026-11-14', '2026-11-28'])
    expect(recurringDates('2027-01-09', 14, '2026-11-01', '2026-11-30')).toEqual(['2026-11-14', '2026-11-28'])
    expect(recurringDates('2026-11-01', 14, '2026-11-01', '2026-11-01')).toEqual(['2026-11-01'])
  })
})
