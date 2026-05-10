export interface OnboardingConfig {
  evidence: {
    maxFiles: number
    maxFileBytes: number
    maxTotalTextBytes: number
    prioritySignalFiles: readonly string[]
  }
  codex: {
    sandboxMode: 'read-only'
    approvalPolicy: 'never'
    reasoningLevel: 'medium'
    timeoutMs: number
  }
}

const PRIORITY_SIGNAL_FILES = [
  'README.md',
  'AGENTS.md',
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'composer.json',
  'Gemfile',
  'pubspec.yaml',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.github/copilot-instructions.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursorrules'
] as const

export const ONBOARDING_CONFIG = {
  evidence: {
    maxFiles: 16,
    maxFileBytes: 14 * 1024,
    maxTotalTextBytes: 80 * 1024,
    prioritySignalFiles: PRIORITY_SIGNAL_FILES
  },
  codex: {
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    reasoningLevel: 'medium',
    timeoutMs: 120_000
  }
} as const satisfies OnboardingConfig
