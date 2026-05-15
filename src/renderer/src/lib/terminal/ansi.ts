const ANSI_ESCAPE_PATTERN = new RegExp(
  `${String.fromCharCode(27)}(?:[@-Z\\\\-_]|\\[[0-?]*[ -/]*[@-~])`,
  'g'
)

function prefixLogLines(value: string, prefix: string): string {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return normalized
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, '')
}

export function formatTerminalStderrEntry(entry: string): string {
  return prefixLogLines(entry, '\x1b[33m[stderr]\x1b[0m ')
}

export function formatTerminalErrorEntry(error: string): string {
  return `\x1b[31m[error] ${error}\x1b[0m`
}

export function formatTerminalExitEntry(code?: number | null): string {
  const renderedCode = code ?? 'null'

  if (typeof code === 'number' && code !== 0) {
    return `\x1b[31m[exit] code=${renderedCode}\x1b[0m`
  }

  return `\x1b[2m[exit] code=${renderedCode}\x1b[0m`
}

export function formatTerminalSystemEntry(message: string): string {
  return `\x1b[2m[system]\x1b[0m ${message}`
}
