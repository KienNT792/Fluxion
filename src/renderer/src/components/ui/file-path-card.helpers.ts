export interface DisplayPathParts {
  basename: string
  parentPath: string
  fullPath: string
}

export function splitDisplayPath(pathValue?: string | null): DisplayPathParts {
  const fullPath = pathValue?.trim() ?? ''
  if (!fullPath) {
    return {
      basename: 'No file',
      parentPath: 'No path available',
      fullPath: ''
    }
  }

  const normalizedPath = fullPath.replace(/[\\/]+$/, '')
  const match = /^(.*[\\/])?([^\\/]+)$/.exec(normalizedPath)
  const basename = match?.[2] ?? normalizedPath
  const parentPath = (match?.[1] ?? '').replace(/[\\/]$/, '')

  return {
    basename,
    parentPath: parentPath || 'Current folder',
    fullPath
  }
}
