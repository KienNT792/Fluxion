import { describe, expect, it } from 'vitest'
import {
  ensureTerminalLine,
  formatTerminalExitEntry,
  formatTerminalLogsForClipboard,
  formatTerminalStderrEntry,
  stripAnsi,
  truncateTerminalText
} from '.'

describe('terminal formatting helpers', () => {
  it('normalizes terminal line endings and ensures a trailing line break', () => {
    expect(ensureTerminalLine('hello\nworld')).toBe('hello\r\nworld\r\n')
    expect(ensureTerminalLine('hello\r\nworld\r\n')).toBe('hello\r\nworld\r\n')
  })

  it('formats stderr as warning output instead of fatal red text', () => {
    expect(formatTerminalStderrEntry('write blocked')).toContain('[stderr]')
    expect(formatTerminalStderrEntry('write blocked')).toContain('\x1b[33m')
  })

  it('only treats non-zero exit codes as fatal', () => {
    expect(formatTerminalExitEntry(0)).toContain('\x1b[2m[exit] code=0')
    expect(formatTerminalExitEntry(1)).toContain('\x1b[31m[exit] code=1')
  })

  it('strips ansi sequences when copying all logs', () => {
    const copied = formatTerminalLogsForClipboard([
      '\x1b[33m[stderr]\x1b[0m write blocked',
      '\x1b[31m[error] failed\x1b[0m'
    ])

    expect(copied).toBe('[stderr] write blocked\n[error] failed')
    expect(stripAnsi(copied)).toBe(copied)
  })

  it('truncates long terminal labels for compact header display', () => {
    expect(truncateTerminalText('short', 10)).toBe('short')
    expect(truncateTerminalText('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefg...')
  })
})
