export const MAX_EVIDENCE_FILES = 16
export const MAX_FILE_BYTES = 14 * 1024
export const MAX_TOTAL_TEXT_BYTES = 80 * 1024

export const PRIORITY_SIGNAL_FILES = [
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
