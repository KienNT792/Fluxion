export function hasFileDrop(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}

export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function formatRecentTimestamp(value: string): string {
  const openedAt = new Date(value)

  if (Number.isNaN(openedAt.getTime())) {
    return 'Opened recently'
  }

  return `Opened ${openedAt.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`
}
