import { useEffect, useState } from 'react'

export function formatDurationMs(durationMs?: number): string | null {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    return null
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function deriveDurationMs(input: {
  startedAt?: string
  completedAt?: string
  durationMs?: number
  now?: number
  isRunning?: boolean
}): number | undefined {
  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs) && input.durationMs >= 0) {
    return input.durationMs
  }

  const startedAtMs = input.startedAt ? Date.parse(input.startedAt) : Number.NaN
  if (!Number.isFinite(startedAtMs)) {
    return undefined
  }

  const endMs = input.completedAt
    ? Date.parse(input.completedAt)
    : input.isRunning
      ? (input.now ?? Date.now())
      : Number.NaN

  if (!Number.isFinite(endMs)) {
    return undefined
  }

  return Math.max(0, endMs - startedAtMs)
}

export function useRuntimeNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) {
      return
    }

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [enabled])

  return now
}
