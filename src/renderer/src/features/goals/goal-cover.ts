/** Cosmetic, device-local preferences: never goal facts or ordering inputs. */
export const GOAL_COVER_KEY_PREFIX = 'mytracer.goal-cover.v1:'
const ordinals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function validateGoalCoverMark(input: string): { value: string; valid: boolean } {
  const value = input.trim()
  if (!value) return { value, valid: true }
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
  return {
    value,
    valid:
      segments.length <= 2 &&
      !/[\s\p{Cc}\p{Cs}\u202a-\u202e\u2066-\u2069]/u.test(value) &&
      segments.every(({ segment }) => /[\p{L}\p{N}\p{P}\p{S}]/u.test(segment))
  }
}

export function goalCoverMark(position: number, custom: string): string {
  const parsed = validateGoalCoverMark(custom)
  return parsed.valid && parsed.value ? parsed.value : (ordinals[position] ?? String(position + 1))
}

export function readGoalCoverMark(
  goalId: string,
  getStorage: () => Pick<Storage, 'getItem'> = () => window.localStorage
): string {
  try {
    const value =
      getStorage().getItem(`${GOAL_COVER_KEY_PREFIX}${encodeURIComponent(goalId)}`) ?? ''
    const parsed = validateGoalCoverMark(value)
    return parsed.valid ? parsed.value : ''
  } catch {
    return ''
  }
}

export function saveGoalCoverMark(
  goalId: string,
  input: string,
  getStorage: () => Pick<Storage, 'setItem' | 'removeItem'> = () => window.localStorage
): boolean {
  const parsed = validateGoalCoverMark(input)
  if (!parsed.valid) return false
  try {
    const key = `${GOAL_COVER_KEY_PREFIX}${encodeURIComponent(goalId)}`
    const storage = getStorage()
    if (parsed.value) storage.setItem(key, parsed.value)
    else storage.removeItem(key)
    return true
  } catch {
    return false
  }
}
