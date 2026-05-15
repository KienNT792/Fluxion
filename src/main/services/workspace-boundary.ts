import * as fs from 'fs'
import * as path from 'path'

function normalizeForBoundary(value: string): string {
  const resolved = path.resolve(value)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function isSameOrInside(rootPath: string, targetPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function findExistingAncestor(targetPath: string): {
  ancestorPath: string
  remainingSegments: string[]
} {
  let currentPath = path.resolve(targetPath)
  const remainingSegments: string[] = []

  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath)
    if (parentPath === currentPath) {
      break
    }

    remainingSegments.push(path.basename(currentPath))
    currentPath = parentPath
  }

  return {
    ancestorPath: currentPath,
    remainingSegments: remainingSegments.reverse()
  }
}

function resolveWriteTargetRealPath(targetPath: string): string {
  const { ancestorPath, remainingSegments } = findExistingAncestor(targetPath)
  const ancestorRealPath = fs.realpathSync.native(ancestorPath)
  return path.resolve(ancestorRealPath, ...remainingSegments)
}

export function assertWorkspaceBound(workspacePath: string, absolutePath: string): void {
  const workspaceRoot = path.resolve(workspacePath)
  const targetPath = path.resolve(absolutePath)

  if (!isSameOrInside(workspaceRoot, targetPath)) {
    throw new Error(`Refusing to write outside the workspace: ${absolutePath}`)
  }

  const workspaceRealPath = fs.realpathSync.native(workspaceRoot)
  const targetRealPath = resolveWriteTargetRealPath(targetPath)

  if (
    !isSameOrInside(normalizeForBoundary(workspaceRealPath), normalizeForBoundary(targetRealPath))
  ) {
    throw new Error(`Refusing to write outside the workspace: ${absolutePath}`)
  }
}
