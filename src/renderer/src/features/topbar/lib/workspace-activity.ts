import { splitDisplayPath } from '@renderer/components/ui/FilePathCard'

export type WorkspaceChangeType = 'add' | 'change' | 'unlink'

export interface WorkspaceActivityChange {
  changeType: WorkspaceChangeType
  filePath: string
  receivedAt: number
  relativePath: string
}

export interface WorkspaceActivityItem {
  basename: string
  filePath: string
  key: string
  parentPath: string
  receivedAt: string
  relativePath: string
  token: string
  tokenColor: string
}

export function formatChangeTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function getChangeToken(changeType: WorkspaceChangeType): string {
  if (changeType === 'add') {
    return 'A'
  }

  if (changeType === 'unlink') {
    return 'D'
  }

  return 'M'
}

export function getChangeTokenColor(changeType: WorkspaceChangeType): string {
  if (changeType === 'add') {
    return 'var(--color-status-completed)'
  }

  if (changeType === 'unlink') {
    return 'var(--color-semantic-error)'
  }

  return 'var(--color-timeline-read)'
}

export function buildActivityDetailItems(
  recentWorkspaceChanges: WorkspaceActivityChange[]
): WorkspaceActivityItem[] {
  return recentWorkspaceChanges.map((change) => {
    const displayPath = splitDisplayPath(change.relativePath)

    return {
      key: `${change.filePath}-${change.receivedAt}`,
      token: getChangeToken(change.changeType),
      tokenColor: getChangeTokenColor(change.changeType),
      filePath: change.filePath,
      relativePath: change.relativePath,
      basename: displayPath.basename,
      parentPath: displayPath.parentPath,
      receivedAt: formatChangeTime(change.receivedAt)
    }
  })
}
