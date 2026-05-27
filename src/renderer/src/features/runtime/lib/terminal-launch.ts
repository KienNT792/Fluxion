import type { OpenTerminalPayload } from '@shared'

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''")
}

export interface NodeTerminalLaunchOptions {
  workspacePath: string
  runId?: string
  nodeId: string
  nodeLabel?: string
  outputPath?: string
  mode?: 'default' | 'debug' | 'review'
  issueHint?: string
  focusHint?: string
}

export function buildNodeTerminalLaunchPayload(
  options: NodeTerminalLaunchOptions
): OpenTerminalPayload {
  const label = options.nodeLabel?.trim() || options.nodeId
  const escapedWorkspace = escapePowerShellSingleQuoted(options.workspacePath)
  const escapedRunId = escapePowerShellSingleQuoted(options.runId ?? '')
  const escapedNodeId = escapePowerShellSingleQuoted(options.nodeId)
  const escapedLabel = escapePowerShellSingleQuoted(label)
  const escapedOutputPath = escapePowerShellSingleQuoted(options.outputPath ?? '')
  const escapedIssueHint = escapePowerShellSingleQuoted(options.issueHint ?? '')
  const escapedFocusHint = escapePowerShellSingleQuoted(options.focusHint ?? '')
  const mode = options.mode ?? 'default'
  const traceHint =
    options.runId && options.runId.trim().length > 0
      ? `.fluxion\\runs\\${options.runId}.trace.jsonl`
      : ''
  const escapedTraceHint = escapePowerShellSingleQuoted(traceHint)

  const script = [
    `$workspace = '${escapedWorkspace}'`,
    `$runId = '${escapedRunId}'`,
    `$nodeId = '${escapedNodeId}'`,
    `$nodeLabel = '${escapedLabel}'`,
    `$outputPath = '${escapedOutputPath}'`,
    `$issueHint = '${escapedIssueHint}'`,
    `$focusHint = '${escapedFocusHint}'`,
    `$traceHint = '${escapedTraceHint}'`,
    'Set-Location -LiteralPath $workspace',
    "Write-Host 'Fluxion repro session' -ForegroundColor Cyan",
    "Write-Host ('Workspace : ' + $workspace)",
    "Write-Host ('Node      : ' + $nodeLabel + ' (' + $nodeId + ')')",
    "if ($runId) { Write-Host ('Run       : ' + $runId) }",
    "if ($outputPath) { Write-Host ('Output    : ' + $outputPath) }",
    "if ($issueHint) { Write-Host ('Issue     : ' + $issueHint) -ForegroundColor Yellow }",
    "if ($focusHint) { Write-Host ('Focus     : ' + $focusHint) -ForegroundColor DarkYellow }",
    "if ($traceHint) { Write-Host ('Trace     : ' + $traceHint) }",
    "Write-Host ''",
    "Write-Host 'Useful commands:' -ForegroundColor Yellow",
    "if ($outputPath) { Write-Host ('  Get-Content -LiteralPath ''' + $outputPath + '''') }",
    "if ($traceHint) { Write-Host ('  Get-Content -LiteralPath ''' + $traceHint + ''' -Tail 80') }",
    "Write-Host '  git status --short'",
    ...(mode === 'debug'
      ? [
          "Write-Host '  git diff --stat'",
          "Write-Host '  Get-ChildItem -LiteralPath .fluxion\\\\runs'",
          "Write-Host '  rg --line-number --hidden \"error|warning|failed\" .fluxion src'"
        ]
      : []),
    "Write-Host ''",
    "if ($outputPath -and (Test-Path -LiteralPath $outputPath)) {",
    "  Write-Host 'Output metadata:' -ForegroundColor DarkGray",
    '  Get-Item -LiteralPath $outputPath | Format-List FullName,Length,LastWriteTime',
    '}'
  ].join('; ')

  const multiPanes =
    mode === 'debug' || mode === 'review'
      ? [
          {
            title: `${label} - Repro`,
            commandline: script
          },
          {
            title: `${label} - Trace`,
            commandline: [
              `$workspace = '${escapedWorkspace}'`,
              `$runId = '${escapedRunId}'`,
              `$traceHint = '${escapedTraceHint}'`,
              `$issueHint = '${escapedIssueHint}'`,
              'Set-Location -LiteralPath $workspace',
              "Write-Host 'Fluxion trace view' -ForegroundColor Cyan",
              "if ($issueHint) { Write-Host ('Issue : ' + $issueHint) -ForegroundColor Yellow }",
              "if ($traceHint) { Write-Host ('Trace : ' + $traceHint) }",
              "Write-Host ''",
              "if ($traceHint -and (Test-Path -LiteralPath $traceHint)) {",
              '  Get-Content -LiteralPath $traceHint -Tail 120',
              '} else {',
              "  Write-Host 'No trace file available yet.' -ForegroundColor DarkYellow",
              '}'
            ].join('; ')
          },
          {
            title: `${label} - Workspace`,
            commandline: [
              `$workspace = '${escapedWorkspace}'`,
              `$focusHint = '${escapedFocusHint}'`,
              'Set-Location -LiteralPath $workspace',
              "Write-Host 'Fluxion workspace shell' -ForegroundColor Cyan",
              "if ($focusHint) { Write-Host ('Focus : ' + $focusHint) -ForegroundColor DarkYellow }",
              "Write-Host 'Useful commands:' -ForegroundColor Yellow",
              "Write-Host '  git status --short'",
              "Write-Host '  git diff --stat'",
              "Write-Host '  Get-ChildItem -LiteralPath .fluxion\\\\runs'",
              "Write-Host '  rg --line-number --hidden \"error|warning|failed\" .fluxion src'"
            ].join('; ')
          },
          ...(mode === 'review'
            ? [
                {
                  title: `${label} - Output`,
                  commandline: [
                    `$workspace = '${escapedWorkspace}'`,
                    `$outputPath = '${escapedOutputPath}'`,
                    `$issueHint = '${escapedIssueHint}'`,
                    'Set-Location -LiteralPath $workspace',
                    "Write-Host 'Fluxion review output' -ForegroundColor Cyan",
                    "if ($issueHint) { Write-Host ('Issue  : ' + $issueHint) -ForegroundColor Yellow }",
                    "if ($outputPath) { Write-Host ('Output : ' + $outputPath) }",
                    "Write-Host ''",
                    "if ($outputPath -and (Test-Path -LiteralPath $outputPath)) {",
                    '  Get-Content -LiteralPath $outputPath -Tail 160',
                    '} else {',
                    "  Write-Host 'No output file available yet.' -ForegroundColor DarkYellow",
                    '}'
                  ].join('; ')
                }
              ]
            : [])
        ]
      : undefined

  return {
    cwd: options.workspacePath,
    title: `Fluxion - ${label}`,
    commandline: script,
    panes: multiPanes
  }
}
