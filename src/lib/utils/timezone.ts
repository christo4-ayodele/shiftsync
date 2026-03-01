import { format, toZonedTime, fromZonedTime } from 'date-fns-tz'
import { parseISO, differenceInHours, differenceInMinutes, isWithinInterval, areIntervalsOverlapping } from 'date-fns'

/**
 * Format a UTC timestamp for display in a specific timezone
 */
export function formatInTimezone(date: string | Date, timezone: string, formatStr: string = 'MMM d, yyyy h:mm a'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  const zonedDate = toZonedTime(d, timezone)
  return format(zonedDate, formatStr, { timeZone: timezone })
}

/**
 * Format time only (e.g., "3:00 PM")
 */
export function formatTimeInTimezone(date: string | Date, timezone: string): string {
  return formatInTimezone(date, timezone, 'h:mm a')
}

/**
 * Format date only (e.g., "Mon, Mar 15")
 */
export function formatDateInTimezone(date: string | Date, timezone: string): string {
  return formatInTimezone(date, timezone, 'EEE, MMM d')
}

/**
 * Format a shift time range (e.g., "3:00 PM - 11:00 PM EST")
 */
export function formatShiftTimeRange(startTime: string, endTime: string, timezone: string): string {
  const start = formatTimeInTimezone(startTime, timezone)
  const end = formatTimeInTimezone(endTime, timezone)
  const tz = formatInTimezone(startTime, timezone, 'zzz')
  return `${start} - ${end} ${tz}`
}

/**
 * Get the duration of a shift in hours
 */
export function getShiftDurationHours(startTime: string, endTime: string): number {
  const start = parseISO(startTime)
  const end = parseISO(endTime)
  return differenceInMinutes(end, start) / 60
}

/**
 * Check if two time intervals overlap
 */
export function doShiftsOverlap(
  start1: string, end1: string,
  start2: string, end2: string
): boolean {
  return areIntervalsOverlapping(
    { start: parseISO(start1), end: parseISO(end1) },
    { start: parseISO(start2), end: parseISO(end2) }
  )
}

/**
 * Check minimum gap between shifts (in hours)
 */
export function getGapBetweenShifts(end1: string, start2: string): number {
  return Math.abs(differenceInHours(parseISO(start2), parseISO(end1)))
}

/**
 * Convert a local time (HH:MM) on a specific date in a timezone to UTC
 */
export function localTimeToUTC(date: string, time: string, timezone: string): Date {
  const localDateTimeStr = `${date}T${time}:00`
  return fromZonedTime(localDateTimeStr, timezone)
}

/**
 * Check if a UTC time falls within an availability window (given in local timezone)
 */
export function isTimeInAvailability(
  utcTime: Date,
  availStartTime: string, // HH:MM
  availEndTime: string,   // HH:MM
  timezone: string
): boolean {
  const zonedTime = toZonedTime(utcTime, timezone)
  const hours = zonedTime.getHours()
  const minutes = zonedTime.getMinutes()
  const timeMinutes = hours * 60 + minutes

  const [startH, startM] = availStartTime.split(':').map(Number)
  const [endH, endM] = availEndTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  // Handle overnight availability (e.g., 22:00 - 06:00)
  if (endMinutes <= startMinutes) {
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes
  }

  return timeMinutes >= startMinutes && timeMinutes <= endMinutes
}

/**
 * Get the day of week for a UTC time in a specific timezone (0=Sunday)
 */
export function getDayOfWeekInTimezone(utcTime: string | Date, timezone: string): number {
  const d = typeof utcTime === 'string' ? parseISO(utcTime) : utcTime
  const zonedDate = toZonedTime(d, timezone)
  return zonedDate.getDay()
}

/**
 * Get timezone abbreviation (e.g., "EST", "PST")
 */
export function getTimezoneAbbr(timezone: string): string {
  return format(new Date(), 'zzz', { timeZone: timezone })
}

/**
 * Check if a date falls on a premium shift day (Friday/Saturday evening)
 */
export function isPremiumShift(startTime: string, timezone: string): boolean {
  const dayOfWeek = getDayOfWeekInTimezone(startTime, timezone)
  const zonedTime = toZonedTime(parseISO(startTime), timezone)
  const hour = zonedTime.getHours()
  
  // Friday (5) or Saturday (6), starting at 5pm or later
  return (dayOfWeek === 5 || dayOfWeek === 6) && hour >= 17
}
