import {
  ContextScanResult,
  ContextSourceEvidence,
  ProjectContextDraft,
  ProjectContextCommand,
  ProjectContextComponent,
  ProjectContextField,
  ProjectSecurityPolicy,
  WorkspaceContextType
} from '@shared'
import { normalizeContextEvidence } from './evidence-store'
import { ProjectDetectionResult } from './project-detectors'
import { evaluateProjectContextReadiness } from './readiness-evaluator'
import { WorkspaceSnapshot } from './workspace-snapshot'

function uniqueList(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim() ?? '').filter(Boolean))]
}

function appendUnique(target: string[], values: string[]): void {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value)
    }
  }
}

function chooseFirst(values: Array<string | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? ''
}

function getWorkspaceType(
  snapshot: WorkspaceSnapshot,
  results: ProjectDetectionResult[]
): WorkspaceContextType {
  if (snapshot.hasFile('AGENTS.md')) {
    return 'existing_with_instructions'
  }

  const hasSignals = results.some((result) => {
    const signalCount =
      result.primaryStack.length +
      result.languages.length +
      result.frameworks.length +
      result.importantPaths.length +
      result.verificationCommands.length
    return signalCount > 0
  })

  return hasSignals ? 'existing' : 'blank'
}

function getTopDiscoveredPaths(snapshot: WorkspaceSnapshot): string[] {
  const preferred = [
    'README.md',
    'AGENTS.md',
    'package.json',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'pyproject.toml',
    'requirements.txt',
    'go.mod',
    'Cargo.toml',
    'composer.json',
    'Gemfile',
    'src',
    'app',
    'apps',
    'packages',
    'docs'
  ]

  const discovered = preferred.filter(
    (item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)
  )
  if (discovered.length > 0) {
    return discovered
  }

  return [
    ...snapshot.files.slice(0, 4).map((file) => file.relativePath),
    ...snapshot.directories.slice(0, 4).map((directory) => directory.relativePath)
  ].slice(0, 8)
}

function getScannedSignalFiles(snapshot: WorkspaceSnapshot): string[] {
  const signalNames = new Set([
    '.csproj',
    '.sln',
    'AGENTS.md',
    'Cargo.toml',
    'Chart.yaml',
    'Dockerfile',
    'Gemfile',
    'Pipfile',
    'README.md',
    'build.gradle',
    'build.gradle.kts',
    'composer.json',
    'docker-compose.yml',
    'docker-compose.yaml',
    'go.mod',
    'lerna.json',
    'nx.json',
    'package.json',
    'pnpm-workspace.yaml',
    'pom.xml',
    'pubspec.yaml',
    'pyproject.toml',
    'requirements.txt',
    'rush.json',
    'settings.gradle',
    'settings.gradle.kts',
    'turbo.json'
  ])

  return snapshot.files
    .filter((file) => signalNames.has(file.name) || signalNames.has(file.extension))
    .map((file) => file.relativePath)
}

function addEvidence(
  evidence: ContextSourceEvidence[],
  field: ProjectContextField,
  sourcePath: string,
  confidence: ContextSourceEvidence['confidence'],
  detectorId: string,
  note: string,
  matchedSignals: string[] = []
): void {
  evidence.push({
    field,
    sourcePath,
    confidence,
    detectorId,
    note,
    matchedSignals,
    confidenceReason: note
  })
}

function evidenceIdsForField(
  evidence: ContextSourceEvidence[],
  field: ProjectContextField
): string[] {
  return evidence.filter((item) => item.field === field && item.id).map((item) => item.id as string)
}

function inferCommandCategory(command: string): ProjectContextCommand['category'] {
  const normalized = command.toLowerCase()
  if (normalized.includes('install') || normalized.includes('restore')) {
    return 'setup'
  }
  if (normalized.includes('dev') || normalized.includes('serve') || normalized.includes('start')) {
    return 'dev'
  }
  if (normalized.includes('typecheck') || normalized.includes('tsc')) {
    return 'typecheck'
  }
  if (normalized.includes('lint')) {
    return 'lint'
  }
  if (
    normalized.includes('test') ||
    normalized.includes('pytest') ||
    normalized.includes('rspec')
  ) {
    return 'test'
  }
  if (normalized.includes('build') || normalized.includes('compile')) {
    return 'build'
  }
  if (
    normalized.includes('e2e') ||
    normalized.includes('playwright') ||
    normalized.includes('cypress')
  ) {
    return 'e2e'
  }
  if (normalized.includes('migrate') || normalized.includes('db:')) {
    return 'db'
  }
  return 'other'
}

function inferCommandRisk(command: string): ProjectContextCommand['risk'] {
  const normalized = command.toLowerCase()
  if (
    normalized.includes(' reset ') ||
    normalized.includes(' clean ') ||
    normalized.includes('remove-item') ||
    normalized.includes('rm -rf') ||
    normalized.includes('drop database')
  ) {
    return 'destructive'
  }
  if (
    normalized.includes('install') ||
    normalized.includes('migrate') ||
    normalized.includes('deploy') ||
    normalized.includes('publish')
  ) {
    return 'needs-approval'
  }
  return 'safe'
}

function buildCommandCatalog(
  commands: string[],
  evidence: ContextSourceEvidence[]
): ProjectContextCommand[] {
  const commandEvidenceIds = evidenceIdsForField(evidence, 'verificationCommands')

  return commands.map((command, index) => ({
    id: `command-${index + 1}`,
    label: command,
    command,
    cwd: '.',
    category: inferCommandCategory(command),
    risk: inferCommandRisk(command),
    confidence: commandEvidenceIds.length > 0 ? 'high' : 'medium',
    evidenceIds: commandEvidenceIds
  }))
}

function inferComponentType(
  frameworks: string[],
  primaryStack: string[]
): ProjectContextComponent['type'] {
  const signals = [...frameworks, ...primaryStack].map((value) => value.toLowerCase())
  if (signals.some((signal) => ['react', 'next.js', 'vite', 'vue', 'angular'].includes(signal))) {
    return 'frontend'
  }
  if (
    signals.some((signal) =>
      ['spring boot', 'fastapi', 'django', 'asp.net core', 'laravel'].includes(signal)
    )
  ) {
    return 'backend'
  }
  if (signals.includes('electron')) {
    return 'desktop'
  }
  if (signals.some((signal) => ['flutter', 'react native', 'android', 'ios'].includes(signal))) {
    return 'mobile'
  }
  if (signals.some((signal) => ['terraform', 'docker', 'kubernetes', 'helm'].includes(signal))) {
    return 'infra'
  }
  return 'unknown'
}

function buildComponents(
  snapshot: WorkspaceSnapshot,
  projectName: string,
  primaryStack: string[],
  languages: string[],
  frameworks: string[],
  entrypoints: string[],
  verificationCommands: string[],
  evidence: ContextSourceEvidence[]
): ProjectContextComponent[] {
  const rootEvidenceIds = [
    ...evidenceIdsForField(evidence, 'primaryStack'),
    ...evidenceIdsForField(evidence, 'languages'),
    ...evidenceIdsForField(evidence, 'frameworks')
  ]
  const roots = ['apps', 'packages', 'client', 'server', 'frontend', 'backend'].filter((root) =>
    snapshot.hasDirectory(root)
  )

  if (roots.length === 0) {
    return [
      {
        id: 'root',
        name: projectName,
        type: inferComponentType(frameworks, primaryStack),
        rootPath: '.',
        languages,
        frameworks,
        entrypoints,
        verificationCommands,
        evidenceIds: uniqueList(rootEvidenceIds)
      }
    ]
  }

  return roots.map((root) => ({
    id: root.replaceAll('/', '-'),
    name: root,
    type:
      root.includes('client') || root.includes('frontend')
        ? 'frontend'
        : root.includes('server') || root.includes('backend')
          ? 'backend'
          : root === 'packages'
            ? 'library'
            : 'unknown',
    rootPath: root,
    languages,
    frameworks,
    entrypoints: entrypoints.filter((entrypoint) => entrypoint.startsWith(root)),
    verificationCommands,
    evidenceIds: uniqueList(rootEvidenceIds)
  }))
}

function detectAgentInstructionSources(
  snapshot: WorkspaceSnapshot
): ProjectContextDraft['agentInstructionSources'] {
  const candidates: ProjectContextDraft['agentInstructionSources'] = []
  const addIfPresent = (
    target: ProjectContextDraft['agentInstructionSources'][number]['target'],
    sourcePath: string,
    priority: number
  ): void => {
    if (snapshot.hasFile(sourcePath)) {
      candidates.push({
        target,
        sourcePath,
        scope: '.',
        activation: 'always',
        priority,
        trusted: true
      })
    }
  }

  addIfPresent('codex', 'AGENTS.md', 100)
  addIfPresent('claude', 'CLAUDE.md', 90)
  addIfPresent('gemini', 'GEMINI.md', 80)
  addIfPresent('cursor', '.cursorrules', 70)
  addIfPresent('copilot', '.github/copilot-instructions.md', 60)

  for (const file of snapshot.files) {
    const normalized = file.relativePath.toLowerCase()
    if (normalized.startsWith('.cursor/rules/') && normalized.endsWith('.mdc')) {
      candidates.push({
        target: 'cursor',
        sourcePath: file.relativePath,
        scope: file.relativePath,
        activation: 'path',
        priority: 70,
        trusted: true
      })
    }
    if (normalized.startsWith('.clinerules') && file.extension === '.md') {
      candidates.push({
        target: 'cline',
        sourcePath: file.relativePath,
        scope: file.relativePath,
        activation: 'path',
        priority: 50,
        trusted: true
      })
    }
    if (normalized.startsWith('.windsurf/rules/') && file.extension === '.md') {
      candidates.push({
        target: 'windsurf',
        sourcePath: file.relativePath,
        scope: file.relativePath,
        activation: 'path',
        priority: 50,
        trusted: true
      })
    }
  }

  return candidates.sort((left, right) => right.priority - left.priority)
}

function buildSecurityPolicy(generatedOrIgnoredPaths: string[]): ProjectSecurityPolicy {
  return {
    sensitivePaths: ['.env', '.env.*', '**/*.pem', '**/*secret*', '**/*credential*'],
    generatedOrIgnoredPaths,
    writableRoots: ['.'],
    approvalRequiredFor: [
      'dependency installation',
      'network access',
      'database migrations',
      'destructive file operations'
    ],
    destructiveCommands: ['git reset --hard', 'git clean -fd', 'rm -rf', 'Remove-Item -Recurse'],
    networkPolicy: 'unknown'
  }
}

function unresolvedFieldsForDraft(
  workspaceType: WorkspaceContextType,
  detectedFields: ContextScanResult['detectedFields']
): ProjectContextField[] {
  const unresolved: ProjectContextField[] = []
  const hasStackSignal =
    (detectedFields.primaryStack?.length ?? 0) > 0 ||
    (detectedFields.languages?.length ?? 0) > 0 ||
    (detectedFields.frameworks?.length ?? 0) > 0
  const hasStructureSignal =
    Boolean(detectedFields.architectureSummary?.trim()) ||
    (detectedFields.importantPaths?.length ?? 0) > 0
  const hasVerificationSignal =
    (detectedFields.verificationCommands?.length ?? 0) > 0 ||
    (detectedFields.riskFlags ?? []).some((flag) => flag.toLowerCase().includes('verification'))

  if (!detectedFields.projectGoal?.trim()) {
    unresolved.push('projectGoal')
  }
  if (!detectedFields.targetUsers?.trim()) {
    unresolved.push('targetUsers')
  }
  if (!hasStackSignal) {
    unresolved.push('primaryStack')
  }
  if (!hasStructureSignal) {
    unresolved.push('architectureSummary', 'importantPaths')
  }
  if (!hasVerificationSignal) {
    unresolved.push('verificationCommands')
  }
  if (workspaceType === 'blank') {
    unresolved.push('kickoffIntent', 'firstMilestone')
  }
  unresolved.push('stableRules', 'focusAreas', 'openQuestions')

  return uniqueList(unresolved) as ProjectContextField[]
}

export function synthesizeContextScanResult(
  snapshot: WorkspaceSnapshot,
  results: ProjectDetectionResult[]
): ContextScanResult {
  const workspaceType = getWorkspaceType(snapshot, results)
  const projectName = snapshot.rootPath.split(/[\\/]/).filter(Boolean).pop() || 'Workspace'
  const manifestProjectName = chooseFirst(results.map((result) => result.projectName))
  const evidence = results.flatMap((result) => result.evidence)
  const scannedFiles = getScannedSignalFiles(snapshot)
  const discoveredPaths = getTopDiscoveredPaths(snapshot)

  if (workspaceType === 'existing_with_instructions') {
    addEvidence(
      evidence,
      'workspaceType',
      'AGENTS.md',
      'high',
      'workspace',
      'Workspace contains project-level agent instructions.',
      ['AGENTS.md']
    )
  }
  if (snapshot.truncated) {
    addEvidence(
      evidence,
      'riskFlags',
      'workspace',
      'medium',
      'workspace-snapshot',
      'Workspace scan reached the entry limit and may be incomplete.'
    )
  }

  const primaryStack: string[] = []
  const languages: string[] = []
  const frameworks: string[] = []
  const packageManagers: string[] = []
  const buildSystems: string[] = []
  const testFrameworks: string[] = []
  const verificationCommands: string[] = []
  const importantPaths: string[] = []
  const entrypoints: string[] = []
  const moduleBoundaries: string[] = []
  const generatedOrIgnoredPaths: string[] = []
  const riskFlags: string[] = snapshot.truncated
    ? ['Workspace scan reached the entry limit and may be incomplete.']
    : []
  const recommendedFirstActions: string[] = []

  for (const result of results) {
    appendUnique(primaryStack, result.primaryStack)
    appendUnique(languages, result.languages)
    appendUnique(frameworks, result.frameworks)
    appendUnique(packageManagers, result.packageManagers)
    appendUnique(buildSystems, result.buildSystems)
    appendUnique(testFrameworks, result.testFrameworks)
    appendUnique(verificationCommands, result.verificationCommands)
    appendUnique(importantPaths, result.importantPaths)
    appendUnique(entrypoints, result.entrypoints)
    appendUnique(moduleBoundaries, result.moduleBoundaries)
    appendUnique(generatedOrIgnoredPaths, result.generatedOrIgnoredPaths)
    appendUnique(riskFlags, result.riskFlags)
    appendUnique(recommendedFirstActions, result.recommendedFirstActions)
  }

  if (workspaceType === 'blank') {
    appendUnique(recommendedFirstActions, [
      'Complete kickoff intent, target stack, project goal, and first milestone before running implementation workflows.'
    ])
  }

  if (verificationCommands.length === 0 && workspaceType !== 'blank') {
    appendUnique(riskFlags, ['No verification command was detected for this workspace.'])
  }

  const architectureSummary = uniqueList(
    results.flatMap((result) => result.architectureParts)
  ).join(' ')
  const projectGoal = chooseFirst(results.map((result) => result.projectGoal))
  const targetUsers = chooseFirst(results.map((result) => result.targetUsers))

  addEvidence(
    evidence,
    'projectName',
    'workspace',
    'high',
    'context-synthesizer',
    manifestProjectName && manifestProjectName !== projectName
      ? `Using workspace folder name instead of manifest name "${manifestProjectName}".`
      : 'Using workspace folder name.'
  )

  const agentInstructionSources = detectAgentInstructionSources(snapshot)
  for (const source of agentInstructionSources) {
    addEvidence(
      evidence,
      'agentInstructionSources',
      source.sourcePath,
      'high',
      'agent-instruction-discovery',
      `Detected ${source.target} instruction source.`,
      [source.sourcePath]
    )
  }
  const normalizedEvidence = normalizeContextEvidence(evidence)
  const commandCatalog = buildCommandCatalog(verificationCommands, normalizedEvidence)
  const components = buildComponents(
    snapshot,
    projectName,
    primaryStack,
    languages,
    frameworks,
    entrypoints,
    verificationCommands,
    normalizedEvidence
  )
  const securityPolicy = buildSecurityPolicy(generatedOrIgnoredPaths)
  const readiness = evaluateProjectContextReadiness({
    workspaceType,
    projectGoal,
    targetUsers,
    kickoffIntent: workspaceType === 'blank' ? 'not-sure-yet' : undefined,
    primaryStack,
    languages,
    frameworks,
    architectureSummary,
    firstMilestone: '',
    importantPaths,
    verificationCommands,
    riskFlags,
    recommendedFirstActions
  })

  const detectedFields: ContextScanResult['detectedFields'] = {
    workspaceType,
    projectName,
    projectGoal,
    targetUsers,
    primaryStack,
    languages,
    frameworks,
    packageManagers,
    buildSystems,
    testFrameworks,
    architectureSummary,
    verificationCommands,
    importantPaths,
    entrypoints,
    moduleBoundaries,
    generatedOrIgnoredPaths,
    riskFlags,
    recommendedFirstActions,
    workspaceTrust: 'unknown',
    components,
    commandCatalog,
    agentInstructionSources,
    securityPolicy,
    readiness
  }
  const unresolvedFields = unresolvedFieldsForDraft(workspaceType, detectedFields)

  return {
    workspaceType,
    projectName,
    detectedFields,
    sourceEvidence: normalizedEvidence,
    unresolvedFields,
    scannedFiles,
    discoveredPaths
  }
}

export function buildDraftFieldsFromScan(scan: ContextScanResult): Partial<ProjectContextDraft> {
  return scan.detectedFields
}
