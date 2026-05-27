import { describe, expect, it } from 'vitest'
import { buildNodeTerminalLaunchPayload } from './terminal-launch'

describe('buildNodeTerminalLaunchPayload', () => {
  it('builds a review preset with an output pane', () => {
    const payload = buildNodeTerminalLaunchPayload({
      workspacePath: 'C:\\repo',
      runId: 'run-1',
      nodeId: 'review-node',
      nodeLabel: 'Review Node',
      outputPath: 'C:\\repo\\.fluxion\\memory\\short-term\\workflow-1\\review-node.md',
      mode: 'review',
      issueHint: 'Awaiting review decision',
      focusHint: 'Check output before rerun'
    })

    expect(payload.panes).toHaveLength(4)
    expect(payload.panes?.map((pane) => pane.title)).toEqual([
      'Review Node - Repro',
      'Review Node - Trace',
      'Review Node - Workspace',
      'Review Node - Output'
    ])
    expect(payload.panes?.[3]?.commandline).toContain('Get-Content -LiteralPath $outputPath -Tail 160')
    expect(payload.commandline).toContain("Write-Host ('Issue     : ' + $issueHint)")
    expect(payload.commandline).toContain("Write-Host ('Focus     : ' + $focusHint)")
    expect(payload.panes?.[1]?.commandline).toContain("Write-Host ('Issue : ' + $issueHint)")
    expect(payload.panes?.[2]?.commandline).toContain("Write-Host ('Focus : ' + $focusHint)")
  })
})
