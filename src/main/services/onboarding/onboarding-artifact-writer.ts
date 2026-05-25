import * as fs from 'fs/promises'
import * as path from 'path'
import matter from 'gray-matter'
import { ulid } from 'ulid'
import { WorkflowNodeSchema, WorkflowSchema } from '@core'
import {
  AgentConfigFileOperation,
  CODEX_DEFAULT_MODEL,
  CreateOnboardingWorkflowRequest,
  CreateOnboardingWorkflowResult,
  OnboardingCommandItem,
  OnboardingPacket,
  ProjectContextDraft,
  RepoOnboardingSkillPreview,
  RepoOnboardingSkillPreviewRequest,
  SaveOnboardingPacketRequest,
  SaveOnboardingPacketResult,
  WorkflowNode
} from '@shared'
import { readExistingFile } from '../agent-config/agent-config-merge.service'
import { memoryManager } from '../memory-manager'
import type { OnboardingLogger } from './onboarding-logger'
import { ONBOARDING_CONFIG } from './onboarding-config'
import { assertWorkspaceBound, normalizeWorkspacePath } from './onboarding-paths'
import {
  discoverWorkspaceSkillLibrary,
  formatWorkspaceSkillLibrary
} from './onboarding-skill-library'

function renderBulletLines(items: string[], fallback = '- Unknown'): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : fallback
}

function renderCommandLines(commands: OnboardingCommandItem[]): string {
  if (commands.length === 0) {
    return '- Unknown'
  }

  return commands
    .map((command) => {
      const cwd = command.cwd === '.' ? '' : ` from \`${command.cwd}\``
      return `- ${command.label}: \`${command.command}\`${cwd} (${command.category}, ${command.risk})`
    })
    .join('\n')
}

export function formatOnboardingPacketMarkdown(packet: OnboardingPacket): string {
  const body = [
    '# Fluxion Onboarding Packet',
    '',
    `Project: ${packet.projectName}`,
    `Generated: ${packet.generatedAt}`,
    `Mode: ${packet.generationMode}`,
    '',
    '## Summary',
    packet.projectSummary || 'Unknown',
    '',
    '## Stack',
    renderBulletLines(packet.stack),
    '',
    '## Architecture',
    renderBulletLines(packet.architectureMap),
    '',
    '## Components',
    renderBulletLines(packet.components.map((component) => `${component.name}: ${component.role}`)),
    '',
    '## Commands',
    renderCommandLines(packet.commands),
    '',
    '## Risks',
    renderBulletLines(packet.risks, '- No known risks.'),
    '',
    '## Open Questions',
    renderBulletLines(packet.openQuestions, '- No open questions captured.'),
    '',
    '## Suggested Stable Rules',
    renderBulletLines(packet.suggestedStableRules, '- No stable rules suggested.'),
    '',
    '## Artifact Recommendations',
    renderBulletLines(
      packet.artifactRecommendations.map(
        (artifact) => `${artifact.label}: \`${artifact.relativePath}\` - ${artifact.rationale}`
      )
    ),
    '',
    '## Source Evidence',
    renderBulletLines(
      packet.sourceEvidence.map(
        (evidence) => `\`${evidence.sourcePath}\` (${evidence.confidence}) - ${evidence.note}`
      )
    ),
    '',
    '## Diagnostics',
    `- Files read: ${packet.diagnostics.filesRead}`,
    `- Truncated files: ${packet.diagnostics.truncatedFiles.join(', ') || 'None'}`,
    `- Warnings: ${packet.diagnostics.warnings.join('; ') || 'None'}`,
    '',
    '## Suggested Context Patch',
    '```json',
    JSON.stringify(packet.suggestedContextPatch, null, 2),
    '```',
    ''
  ].join('\n')

  return matter.stringify(body, {
    type: 'long-term',
    artifact: 'onboarding-packet',
    version: packet.version,
    generatedAt: packet.generatedAt,
    generationMode: packet.generationMode
  })
}

function createWorkflowNode(
  id: string,
  label: string,
  prompt: string,
  position: { x: number; y: number },
  humanReview = false
): WorkflowNode {
  const node: WorkflowNode = {
    id,
    type: 'agentNode',
    label,
    position,
    data: {
      provider: 'codex',
      runner: 'codex',
      model: CODEX_DEFAULT_MODEL,
      label,
      prompt,
      reasoningLevel: ONBOARDING_CONFIG.codex.reasoningLevel,
      humanReview,
      codex: {
        json: false,
        sandboxMode: ONBOARDING_CONFIG.codex.sandboxMode,
        approvalPolicy: ONBOARDING_CONFIG.codex.approvalPolicy
      }
    }
  }

  WorkflowNodeSchema.parse(node)
  return node
}

function createOnboardingWorkflowDocument(
  workspacePath: string,
  packet: OnboardingPacket | null,
  now: Date
): CreateOnboardingWorkflowResult['workflow'] {
  const workspaceName = path.basename(workspacePath) || 'Workspace'
  const projectName = packet?.projectName || workspaceName
  const packetPath = '.fluxion/memory/long-term/onboarding.md'
  const nodeA = createWorkflowNode(
    'onboarding-detect',
    'Detect repository signals',
    [
      'Inspect the repository in read-only mode.',
      'Summarize stack signals, manifests, existing instruction files, and important paths.',
      `Use ${packetPath} if it exists, but verify claims against source evidence.`
    ].join('\n'),
    { x: 80, y: 160 }
  )
  const nodeB = createWorkflowNode(
    'onboarding-architecture',
    'Map architecture',
    'Use the detected repository signals to map major components, boundaries, entrypoints, and ownership areas. Keep uncertainty explicit.',
    { x: 400, y: 160 }
  )
  const nodeC = createWorkflowNode(
    'onboarding-commands-risks',
    'Identify commands and risks',
    'Identify safe setup, build, lint, typecheck, and test commands. Flag commands needing approval and any missing verification path.',
    { x: 720, y: 160 }
  )
  const nodeD = createWorkflowNode(
    'onboarding-review',
    'Review onboarding packet',
    [
      'Review the upstream onboarding findings.',
      'Produce a concise final packet with Summary, Architecture, Commands, Risks, Evidence, and Open Questions.',
      'Do not modify source files.'
    ].join('\n'),
    { x: 1040, y: 160 },
    true
  )

  const workflow: CreateOnboardingWorkflowResult['workflow'] = {
    id: ulid(),
    name: `${projectName} - Codex Onboarding`,
    description:
      'Read-only onboarding DAG for mapping repository signals, architecture, commands, risks, and review notes.',
    tags: ['onboarding', 'codex'],
    executionMode: 'manual',
    fluxionVersion: '1.0',
    nodes: [nodeA, nodeB, nodeC, nodeD],
    edges: [
      { id: 'onboarding-edge-detect-architecture', source: nodeA.id, target: nodeB.id },
      { id: 'onboarding-edge-architecture-commands', source: nodeB.id, target: nodeC.id },
      { id: 'onboarding-edge-commands-review', source: nodeC.id, target: nodeD.id }
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }

  WorkflowSchema.parse(workflow)
  return workflow
}

async function uniqueWorkflowFilePath(workspacePath: string): Promise<string> {
  const workflowsDir = path.join(workspacePath, '.fluxion', 'workflows')
  let filePath = path.join(workflowsDir, 'codex-onboarding.fluxion.json')
  let counter = 1

  while (true) {
    try {
      await fs.access(filePath)
      filePath = path.join(workflowsDir, `codex-onboarding-${counter}.fluxion.json`)
      counter += 1
    } catch {
      return filePath
    }
  }
}

function createPreviewOperation(
  workspacePath: string,
  relativePath: string,
  description: string,
  content: string,
  existingContent: string | null
): AgentConfigFileOperation {
  return {
    action: existingContent === null ? 'create' : 'update',
    relativePath,
    absolutePath: path.join(workspacePath, ...relativePath.split('/')),
    description,
    content,
    existingContent: existingContent ?? undefined
  }
}

function renderRepoSkillMarkdown(packet: OnboardingPacket): string {
  return [
    '---',
    'name: fluxion-onboarding',
    'description: Use when initializing project context or when the user explicitly asks to run Fluxion onboarding for this repository.',
    '---',
    '',
    '# Fluxion Onboarding',
    '',
    'Use this skill only during context initialization or when the user asks for onboarding.',
    '',
    '## Workflow',
    '',
    '1. Read repository evidence first: manifests, README, existing agent instructions, important source roots, and Fluxion context.',
    '2. Produce a compact onboarding packet with Summary, Architecture, Commands, Risks, Evidence, and Open Questions.',
    '3. Keep durable rules short. Put detailed findings in long-term memory instead of expanding AGENTS.md.',
    '4. Do not install global skills, edit source files, or run write-capable commands unless the user asks.',
    '',
    '## Output',
    '',
    '- Summary: what the project does and who it serves.',
    '- Architecture: components, boundaries, entrypoints, and important paths.',
    '- Commands: setup, dev, typecheck, lint, test, and build commands with risk levels.',
    '- Risks: approval needs, generated paths, missing verification, and uncertainty.',
    '- Evidence: source paths that support the packet.',
    '',
    '## References',
    '',
    '- `references/onboarding-packet.md` is the latest Fluxion-generated packet.',
    '- `.fluxion/context.json` is the compact runtime context.',
    '- `.fluxion/memory/global-context.md` is the global context passed to workflows.',
    '',
    '## Current Packet Snapshot',
    '',
    `Project: ${packet.projectName}`,
    `Mode: ${packet.generationMode}`,
    `Generated: ${packet.generatedAt}`,
    ''
  ].join('\n')
}

function renderContextReference(context: ProjectContextDraft | null | undefined): string {
  if (!context) {
    return '# Fluxion Context Reference\n\nNo Fluxion context was provided when this skill was exported.\n'
  }

  return [
    '# Fluxion Context Reference',
    '',
    `Project: ${context.projectName}`,
    `Status: ${context.contextStatus}`,
    '',
    '## Goal',
    context.projectGoal || 'Unknown',
    '',
    '## Architecture',
    context.architectureSummary || 'Unknown',
    '',
    '## Durable Rules',
    renderBulletLines(context.stableRules, '- Unknown'),
    '',
    '## Important Paths',
    renderBulletLines(
      context.importantPaths.map((item) => `\`${item}\``),
      '- Unknown'
    ),
    ''
  ].join('\n')
}

async function renderSkillLibraryReference(workspacePath: string): Promise<string> {
  const library = await discoverWorkspaceSkillLibrary(workspacePath)
  if (library.assets.length === 0) {
    return '# Workspace Skill Library\n\nNo workspace skill assets were detected.\n'
  }

  return ['# Workspace Skill Library', '', formatWorkspaceSkillLibrary(library), ''].join('\n')
}

export async function saveOnboardingPacket(
  request: SaveOnboardingPacketRequest,
  logger?: OnboardingLogger
): Promise<SaveOnboardingPacketResult> {
  const workspacePath = normalizeWorkspacePath(request.workspacePath)
  await memoryManager.initWorkspace(workspacePath)
  const filePath = path.join(workspacePath, '.fluxion', 'memory', 'long-term', 'onboarding.md')
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, formatOnboardingPacketMarkdown(request.packet), 'utf-8')
  logger?.info('artifact.packet-saved', {
    workspace: path.basename(workspacePath),
    relativePath: '.fluxion/memory/long-term/onboarding.md'
  })

  return {
    filePath,
    savedAt: new Date().toISOString()
  }
}

export async function createOnboardingWorkflow(
  request: CreateOnboardingWorkflowRequest,
  now: Date,
  logger?: OnboardingLogger
): Promise<CreateOnboardingWorkflowResult> {
  const workspacePath = normalizeWorkspacePath(request.workspacePath)
  const workflow = createOnboardingWorkflowDocument(workspacePath, request.packet ?? null, now)
  const workflowFilePath = await uniqueWorkflowFilePath(workspacePath)

  await fs.mkdir(path.dirname(workflowFilePath), { recursive: true })
  await fs.writeFile(workflowFilePath, JSON.stringify(workflow, null, 2), 'utf-8')
  logger?.info('artifact.workflow-created', {
    workspace: path.basename(workspacePath),
    nodeCount: workflow.nodes.length
  })

  return {
    workflow,
    workflowFilePath
  }
}

export async function createRepoOnboardingSkillPreview(
  request: RepoOnboardingSkillPreviewRequest,
  logger?: OnboardingLogger
): Promise<RepoOnboardingSkillPreview> {
  const workspacePath = normalizeWorkspacePath(request.workspacePath)
  const skillPath = '.agents/skills/fluxion-onboarding/SKILL.md'
  const packetPath = '.agents/skills/fluxion-onboarding/references/onboarding-packet.md'
  const contextPath = '.agents/skills/fluxion-onboarding/references/fluxion-context.md'
  const libraryPath = '.agents/skills/fluxion-onboarding/references/workspace-skill-library.md'
  const operations = await Promise.all([
    readExistingFile(path.join(workspacePath, ...skillPath.split('/'))).then((existing) =>
      createPreviewOperation(
        workspacePath,
        skillPath,
        'Repo-local Fluxion onboarding skill definition.',
        renderRepoSkillMarkdown(request.packet),
        existing
      )
    ),
    readExistingFile(path.join(workspacePath, ...packetPath.split('/'))).then((existing) =>
      createPreviewOperation(
        workspacePath,
        packetPath,
        'Latest Fluxion onboarding packet reference.',
        formatOnboardingPacketMarkdown(request.packet),
        existing
      )
    ),
    readExistingFile(path.join(workspacePath, ...contextPath.split('/'))).then((existing) =>
      createPreviewOperation(
        workspacePath,
        contextPath,
        'Compact Fluxion context reference for the onboarding skill.',
        renderContextReference(request.context),
        existing
      )
    ),
    readExistingFile(path.join(workspacePath, ...libraryPath.split('/'))).then((existing) =>
      renderSkillLibraryReference(workspacePath).then((content) =>
        createPreviewOperation(
          workspacePath,
          libraryPath,
          'Workspace skill library reference for the onboarding skill.',
          content,
          existing
        )
      )
    )
  ])

  logger?.info('artifact.repo-skill-preview-created', {
    workspace: path.basename(workspacePath),
    operationCount: operations.length
  })

  return {
    label: 'Fluxion Onboarding Skill',
    workspacePath,
    createdAt: new Date().toISOString(),
    operations,
    warnings: [
      'This preview writes a repo-local skill only. It does not install a global Codex skill.'
    ]
  }
}

export async function applyRepoOnboardingSkillPreview(
  preview: RepoOnboardingSkillPreview,
  logger?: OnboardingLogger
): Promise<{
  applied: AgentConfigFileOperation[]
  skipped: AgentConfigFileOperation[]
}> {
  const applied: AgentConfigFileOperation[] = []
  const skipped: AgentConfigFileOperation[] = []

  for (const operation of preview.operations) {
    assertWorkspaceBound(preview.workspacePath, operation.absolutePath)
    if (operation.action === 'skip' || operation.action === 'conflict') {
      skipped.push(operation)
      continue
    }

    await fs.mkdir(path.dirname(operation.absolutePath), { recursive: true })
    await fs.writeFile(operation.absolutePath, operation.content, 'utf-8')
    applied.push(operation)
  }

  logger?.info('artifact.repo-skill-preview-applied', {
    workspace: path.basename(preview.workspacePath),
    applied: applied.length,
    skipped: skipped.length
  })

  return { applied, skipped }
}
