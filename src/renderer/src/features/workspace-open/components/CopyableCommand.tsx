import React from 'react'
import { Copy, Terminal } from 'lucide-react'

export const CopyableCommand: React.FC<{ command: string }> = ({ command }) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard may be unavailable in some contexts
    }
  }

  return (
    <div
      className="flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs"
      style={{
        background: 'var(--color-canvas)',
        border: '1px solid var(--color-hairline)',
        color: 'var(--color-ink)'
      }}
    >
      <Terminal size={12} className="shrink-0" style={{ color: 'var(--color-muted)' }} />
      <code className="flex-1 select-all">{command}</code>
      <button
        type="button"
        onClick={() => {
          void handleCopy()
        }}
        className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-sans transition-colors hover:bg-[var(--color-canvas-soft)]"
        style={{ color: copied ? 'var(--color-semantic-success)' : 'var(--color-muted)' }}
        aria-label="Copy command"
      >
        {copied ? 'Copied' : <Copy size={11} />}
      </button>
    </div>
  )
}
