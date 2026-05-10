import * as path from 'path'
import type { ContextScanResult, ProjectContextDraft } from '@shared'
import type { WorkspaceSnapshot, WorkspaceSnapshotFile } from '../context/workspace-snapshot'
import { ONBOARDING_CONFIG } from './onboarding-config'
import type { OnboardingLogger } from './onboarding-logger'
import { normalizeOnboardingRelativePath, shouldSkipOnboardingPath } from './onboarding-paths'
import { uniqueList } from './onboarding-utils'

export interface OnboardingEvidenceFile {
  relativePath: string
  content: string
  truncated: boolean
  size: number
}

export interface OnboardingEvidencePack {
  files: OnboardingEvidenceFile[]
  truncatedFiles: string[]
}

function findSnapshotFile(
  snapshot: WorkspaceSnapshot,
  relativePath: string
): WorkspaceSnapshotFile | undefined {
  const normalized = relativePath.toLowerCase()
  return snapshot.files.find((file) => file.relativePath.toLowerCase() === normalized)
}

export function collectOnboardingCandidatePaths(
  draft: ProjectContextDraft,
  scanResult: ContextScanResult
): string[] {
  return uniqueList([
    ...ONBOARDING_CONFIG.evidence.prioritySignalFiles,
    ...scanResult.scannedFiles,
    ...scanResult.discoveredPaths,
    ...draft.importantPaths,
    ...draft.entrypoints,
    ...draft.moduleBoundaries,
    ...draft.agentInstructionSources.map((source) => source.sourcePath)
  ])
    .map((candidate) => normalizeOnboardingRelativePath(candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
    .filter((candidate) => !shouldSkipOnboardingPath(candidate))
}

export async function buildEvidencePack(
  workspacePath: string,
  draft: ProjectContextDraft,
  scanResult: ContextScanResult,
  createSnapshot: (workspacePath: string) => Promise<WorkspaceSnapshot>,
  logger?: OnboardingLogger
): Promise<OnboardingEvidencePack> {
  const snapshot = await createSnapshot(workspacePath)
  const files: OnboardingEvidenceFile[] = []
  const truncatedFiles: string[] = []
  let totalBytes = 0

  for (const relativePath of collectOnboardingCandidatePaths(draft, scanResult)) {
    if (
      files.length >= ONBOARDING_CONFIG.evidence.maxFiles ||
      totalBytes >= ONBOARDING_CONFIG.evidence.maxTotalTextBytes
    ) {
      break
    }
    if (!snapshot.hasFile(relativePath)) {
      continue
    }

    const file = findSnapshotFile(snapshot, relativePath)
    if (!file) {
      continue
    }

    const remainingBytes = ONBOARDING_CONFIG.evidence.maxTotalTextBytes - totalBytes
    const maxBytes = Math.min(ONBOARDING_CONFIG.evidence.maxFileBytes, remainingBytes)
    const content = await snapshot.readText(relativePath, maxBytes)
    if (!content?.trim()) {
      continue
    }

    const truncated = file.size > maxBytes
    if (truncated) {
      truncatedFiles.push(relativePath)
    }

    files.push({
      relativePath,
      content,
      truncated,
      size: file.size
    })
    totalBytes += Buffer.byteLength(content, 'utf8')
  }

  logger?.info('evidence.collected', {
    workspace: path.basename(workspacePath),
    filesRead: files.length,
    truncatedFiles: truncatedFiles.length,
    totalBytes
  })

  return { files, truncatedFiles }
}
