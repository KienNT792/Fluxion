import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { RunnerContext, RunnerEvent, RunnerResult, WorkflowSchema } from '@core'
import { normalizeProjectContextDraft, ONBOARDING_PACKET_VERSION, OnboardingPacket } from '@shared'
import { OnboardingService } from '../services/onboarding.service'

class FakeOnboardingRunner {
  public capturedContext: RunnerContext | null = null

  public constructor(private readonly output: string) {}

  public async *run(ctx: RunnerContext): AsyncGenerator<RunnerEvent, RunnerResult, void> {
    this.capturedContext = ctx
    yield {
      type: 'status',
      content: 'fake onboarding started',
      timestamp: Date.now()
    }
    return {
      success: true,
      output: this.output,
      exitCode: 0
    }
  }
}

async function writeWorkspaceFile(
  workspacePath: string,
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = join(workspacePath, relativePath)
  await mkdir(dirname(fullPath), { recursive: true })
  await writeFile(fullPath, content, 'utf8')
}

function createCodexPacket(): OnboardingPacket {
  return {
    version: ONBOARDING_PACKET_VERSION,
    projectName: 'Fixture',
    generatedAt: '2026-01-02T00:00:00.000Z',
    generationMode: 'codex-assisted',
    projectSummary: 'Codex-assisted packet.',
    stack: ['TypeScript'],
    components: [],
    architectureMap: ['Root application'],
    commands: [],
    risks: [],
    openQuestions: [],
    suggestedContextPatch: {
      projectGoal: 'Build a fixture project.'
    },
    suggestedStableRules: ['Keep changes scoped.'],
    artifactRecommendations: [
      {
        kind: 'memory',
        label: 'Save onboarding packet',
        relativePath: '.fluxion/memory/long-term/onboarding.md',
        rationale: 'Keep details out of compact context.'
      }
    ],
    skillAssets: [],
    sourceEvidence: [
      {
        id: 'evidence-1',
        sourcePath: 'README.md',
        confidence: 'high',
        note: 'README provided.',
        matchedSignals: []
      }
    ],
    diagnostics: {
      generatedAt: '2026-01-02T00:00:00.000Z',
      mode: 'codex-assisted',
      model: 'gpt-5.5',
      filesRead: 1,
      truncatedFiles: [],
      warnings: []
    }
  }
}

describe('onboarding.service', () => {
  const workspaces: string[] = []

  afterEach(async () => {
    await Promise.all(
      workspaces.map((workspacePath) => rm(workspacePath, { recursive: true, force: true }))
    )
  })

  async function createWorkspace(): Promise<string> {
    const workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-onboarding-'))
    workspaces.push(workspacePath)
    return workspacePath
  }

  it.each([
    {
      name: 'Node',
      files: {
        'pnpm-lock.yaml': 'lockfileVersion: 9.0',
        'package.json': JSON.stringify({
          name: 'node-app',
          description: 'Node app',
          scripts: { typecheck: 'tsc --noEmit', test: 'vitest run' },
          dependencies: { react: '^19.0.0', electron: '^39.0.0' },
          devDependencies: { typescript: '^5.0.0', vitest: '^4.0.0' }
        }),
        'src/main/index.ts': 'export {}'
      },
      expectedStack: 'Electron',
      expectedCommand: 'pnpm typecheck'
    },
    {
      name: 'Python',
      files: {
        'pyproject.toml': '[project]\nname = "py-api"\ndependencies = ["fastapi", "pytest"]\n',
        'src/app.py': 'print("hello")',
        'tests/test_app.py': 'def test_app():\n    assert True\n'
      },
      expectedStack: 'FastAPI',
      expectedCommand: 'python -m pytest'
    },
    {
      name: 'Java',
      files: {
        'pom.xml':
          '<project><artifactId>java-api</artifactId><dependencies><dependency><artifactId>spring-boot-starter</artifactId></dependency></dependencies></project>',
        'src/main/java/com/example/Application.java': 'class Application {}'
      },
      expectedStack: 'Spring Boot',
      expectedCommand: 'mvn test'
    },
    {
      name: 'Monorepo',
      files: {
        'pnpm-workspace.yaml': 'packages:\n  - apps/*\n  - packages/*\n',
        'pnpm-lock.yaml': 'lockfileVersion: 9.0',
        'package.json': JSON.stringify({ name: 'mono', scripts: { test: 'vitest run' } }),
        'apps/web/package.json': JSON.stringify({ name: 'web' }),
        'packages/lib/package.json': JSON.stringify({ name: 'lib' })
      },
      expectedStack: 'Monorepo',
      expectedCommand: 'pnpm test'
    }
  ])(
    'creates a deterministic packet from $name fixtures',
    async ({ files, expectedCommand, expectedStack }) => {
      const workspacePath = await createWorkspace()
      for (const [relativePath, content] of Object.entries(files)) {
        await writeWorkspaceFile(workspacePath, relativePath, content)
      }

      const service = new OnboardingService({
        now: () => new Date('2026-01-02T00:00:00.000Z')
      })
      const packet = await service.generatePacket({ workspacePath, mode: 'deterministic' })

      expect(packet.stack).toContain(expectedStack)
      expect(packet.commands.map((command) => command.command)).toContain(expectedCommand)
      expect(packet.diagnostics.mode).toBe('deterministic')
    }
  )

  it('excludes secrets from onboarding evidence even when suggested by draft paths', async () => {
    const workspacePath = await createWorkspace()
    await writeWorkspaceFile(workspacePath, 'README.md', '# Fixture\n\nA safe project.')
    const skippedPaths = [
      '.env',
      '.env.local',
      'config/secret.json',
      'config/credentials.json',
      'certs/private-key.pem',
      'certs/server.key',
      'keys/id_rsa',
      'vendor/pkg/index.js',
      'node_modules/lib/index.js',
      'dist/app.js',
      'build/app.js',
      'coverage/report.json'
    ]
    for (const skippedPath of skippedPaths) {
      await writeWorkspaceFile(workspacePath, skippedPath, 'OPENAI_API_KEY=secret')
    }
    const draft = normalizeProjectContextDraft({
      workspaceType: 'existing',
      projectName: 'Fixture',
      projectGoal: 'Test secrets',
      importantPaths: ['README.md', ...skippedPaths],
      sourceEvidence: []
    })
    const service = new OnboardingService()

    const packet = await service.generatePacket({ workspacePath, draft, mode: 'deterministic' })

    const sourcePaths = packet.sourceEvidence.map((evidence) => evidence.sourcePath)
    expect(sourcePaths).toContain('README.md')
    for (const skippedPath of skippedPaths) {
      expect(sourcePaths).not.toContain(skippedPath)
    }
  })

  it('runs Codex onboarding with read-only non-interactive permissions', async () => {
    const workspacePath = await createWorkspace()
    await writeWorkspaceFile(workspacePath, 'README.md', '# Fixture\n\nCodex onboarding fixture.')
    const runner = new FakeOnboardingRunner(JSON.stringify(createCodexPacket()))
    const service = new OnboardingService({
      runner,
      now: () => new Date('2026-01-02T00:00:00.000Z')
    })

    const packet = await service.generatePacket({ workspacePath, mode: 'codex-assisted' })

    expect(packet.generationMode).toBe('codex-assisted')
    expect(runner.capturedContext?.node.data.codex).toMatchObject({
      sandboxMode: 'read-only',
      approvalPolicy: 'never'
    })
    expect(runner.capturedContext?.prompt).toContain('Return strict JSON only')
    expect(runner.capturedContext?.prompt).not.toContain('OPENAI_API_KEY')
  })

  it('normalizes Codex command enum aliases before validating the packet', async () => {
    const workspacePath = await createWorkspace()
    await writeWorkspaceFile(workspacePath, 'README.md', '# Fixture\n\nCodex onboarding fixture.')
    const invalidEnumPacket = {
      ...createCodexPacket(),
      commands: [
        {
          id: 'command-1',
          label: 'Verify',
          command: 'npm run test',
          cwd: '.',
          category: 'verification',
          risk: 'low',
          confidence: 'medium',
          evidenceIds: []
        }
      ]
    }
    const service = new OnboardingService({
      runner: new FakeOnboardingRunner(JSON.stringify(invalidEnumPacket)),
      now: () => new Date('2026-01-02T00:00:00.000Z')
    })

    const packet = await service.generatePacket({ workspacePath, mode: 'codex-assisted' })

    expect(packet.commands[0]).toMatchObject({
      category: 'test',
      risk: 'safe'
    })
    expect(packet.diagnostics.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Normalized invalid onboarding command category'),
        expect.stringContaining('Normalized invalid onboarding command risk')
      ])
    )
  })

  it('returns a clear error when Codex onboarding output is not JSON', async () => {
    const workspacePath = await createWorkspace()
    await writeWorkspaceFile(workspacePath, 'README.md', '# Fixture\n\nCodex onboarding fixture.')
    const service = new OnboardingService({
      runner: new FakeOnboardingRunner('not json')
    })

    await expect(service.generatePacket({ workspacePath, mode: 'codex-assisted' })).rejects.toThrow(
      /non-JSON output/
    )
  })

  it('saves onboarding packet to long-term memory', async () => {
    const workspacePath = await createWorkspace()
    const service = new OnboardingService()
    const packet = createCodexPacket()

    const result = await service.savePacket({ workspacePath, packet })
    const content = await readFile(result.filePath, 'utf8')

    expect(result.filePath.replaceAll('\\', '/')).toContain(
      '.fluxion/memory/long-term/onboarding.md'
    )
    expect(content).toContain('Fluxion Onboarding Packet')
    expect(content).toContain('Codex-assisted packet.')
  })

  it('creates a valid onboarding workflow document', async () => {
    const workspacePath = await createWorkspace()
    const service = new OnboardingService({
      now: () => new Date('2026-01-02T00:00:00.000Z')
    })

    const result = await service.createWorkflow({ workspacePath, packet: createCodexPacket() })

    expect(WorkflowSchema.safeParse(result.workflow).success).toBe(true)
    expect(result.workflow.nodes.map((node) => node.label)).toEqual([
      'Detect repository signals',
      'Map architecture',
      'Identify commands and risks',
      'Review onboarding packet'
    ])
    expect(result.workflowFilePath.replaceAll('\\', '/')).toContain(
      '.fluxion/workflows/codex-onboarding.fluxion.json'
    )
  })

  it('previews repo-local skill files and writes them only on apply', async () => {
    const workspacePath = await createWorkspace()
    const service = new OnboardingService()
    const preview = await service.createRepoSkillPreview({
      workspacePath,
      packet: createCodexPacket(),
      context: null
    })
    const skillPath = join(workspacePath, '.agents', 'skills', 'fluxion-onboarding', 'SKILL.md')

    await expect(stat(skillPath)).rejects.toThrow()
    expect(preview.operations.map((operation) => operation.relativePath)).toContain(
      '.agents/skills/fluxion-onboarding/SKILL.md'
    )

    await service.applyRepoSkillPreview(preview)
    const skill = await readFile(skillPath, 'utf8')
    expect(skill).toContain('name: fluxion-onboarding')
  })

  it('rejects repo-local skill apply when the target escapes through a symlink', async () => {
    const workspacePath = await createWorkspace()
    const outsidePath = await createWorkspace()
    const service = new OnboardingService()
    const linkPath = join(workspacePath, '.agents')
    await symlink(outsidePath, linkPath, process.platform === 'win32' ? 'junction' : 'dir')

    await expect(
      service.applyRepoSkillPreview({
        label: 'Fluxion Onboarding Skill',
        workspacePath,
        createdAt: '2026-01-02T00:00:00.000Z',
        warnings: [],
        operations: [
          {
            action: 'create',
            relativePath: '.agents/skills/fluxion-onboarding/SKILL.md',
            absolutePath: join(linkPath, 'skills', 'fluxion-onboarding', 'SKILL.md'),
            description: 'Escaping repo-local skill write.',
            content: '# Should not be written'
          }
        ]
      })
    ).rejects.toThrow(/outside the workspace/)

    await expect(
      stat(join(outsidePath, 'skills', 'fluxion-onboarding', 'SKILL.md'))
    ).rejects.toThrow()
  })
})
