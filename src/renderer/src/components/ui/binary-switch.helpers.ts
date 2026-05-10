export function getNextBinarySwitchValueFromKey(
  key: string,
  currentValue: boolean
): boolean | null {
  if (key === 'Enter' || key === ' ') {
    return !currentValue
  }

  if (key === 'ArrowLeft') {
    return false
  }

  if (key === 'ArrowRight') {
    return true
  }

  return null
}
