import { format, isValid, parseISO, startOfDay } from 'date-fns'

const DATE_ONLY_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/

export function parseDateOnly(value: string): Date {
  const dateOnly = DATE_ONLY_PATTERN.exec(value)?.[1]
  if (!dateOnly) throw new RangeError('Invalid date-only value')

  const parsed = parseISO(dateOnly)
  if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== dateOnly) {
    throw new RangeError('Invalid date-only value')
  }

  return parsed
}

export function formatDateOnly(value: string): string {
  try {
    return format(parseDateOnly(value), 'dd/MM/yyyy')
  } catch {
    return value
  }
}

export function dateOnlyHasNotEnded(value: string, now = new Date()): boolean {
  try {
    return parseDateOnly(value) >= startOfDay(now)
  } catch {
    return false
  }
}
