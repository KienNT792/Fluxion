import { ContextScanResult } from '@shared'
import { synthesizeContextScanResult } from './context/context-synthesizer'
import { runProjectDetectors } from './context/project-detectors'
import { createWorkspaceSnapshot } from './context/workspace-snapshot'

export async function scanWorkspaceContext(workspacePath: string): Promise<ContextScanResult> {
  const snapshot = await createWorkspaceSnapshot(workspacePath)
  const detectionResults = await runProjectDetectors(snapshot)

  return synthesizeContextScanResult(snapshot, detectionResults)
}
