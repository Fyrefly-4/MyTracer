export const RECORD_SUMMARY_LIMIT = 500

export function recordSummary(
  value: string | null | undefined,
  error: (message: string) => Error
): string | null {
  if (value == null) return null
  if (typeof value !== 'string' || Array.from(value).length > RECORD_SUMMARY_LIMIT)
    throw error('简述请保持在 500 字以内。')
  return value.trim() ? value : null
}
