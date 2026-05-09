import { stripAnsi } from './ansi';

export function normalizeTerminalNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
}

export function ensureTerminalLine(value: string): string {
  const normalized = normalizeTerminalNewlines(value);
  return normalized.endsWith('\r\n') ? normalized : `${normalized}\r\n`;
}

export function normalizeClipboardNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function formatTerminalLogsForClipboard(logs: string[]): string {
  return logs
    .map((entry) => normalizeClipboardNewlines(stripAnsi(entry)))
    .join('\n');
}

export function truncateTerminalText(value: string, maxLength = 120): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}
