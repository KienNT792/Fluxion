import React from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'

interface WorkspaceMemoryEditorProps {
  globalContext: string
  longTermIndex: string
  isSaving: boolean
  onGlobalContextChange: (value: string) => void
  onLongTermIndexChange: (value: string) => void
  onSave: () => Promise<void>
}

export const WorkspaceMemoryEditor: React.FC<WorkspaceMemoryEditorProps> = ({
  globalContext,
  longTermIndex,
  isSaving,
  onGlobalContextChange,
  onLongTermIndexChange,
  onSave
}) => (
  <div
    className="rounded-lg px-4 py-4"
    style={{
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)'
    }}
  >
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
          Global context and long-term memory
        </p>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
          Edit the workspace-wide context file and the long-term memory index in place.
        </p>
      </div>
      <Button variant="primary" onClick={() => void onSave()} disabled={isSaving}>
        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save memory files
      </Button>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <label className="block">
        <span
          className="text-[11px] uppercase tracking-[0.08em]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          .fluxion/memory/global-context.md
        </span>
        <textarea
          className="mt-2 min-h-56 w-full rounded-md border px-3 py-2 text-xs leading-5"
          style={{
            background: 'var(--color-canvas-soft)',
            borderColor: 'var(--color-hairline)',
            color: 'var(--color-body)',
            fontFamily: 'var(--font-mono)'
          }}
          value={globalContext}
          onChange={(event) => onGlobalContextChange(event.target.value)}
        />
      </label>

      <label className="block">
        <span
          className="text-[11px] uppercase tracking-[0.08em]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          .fluxion/memory/long-term/index.md
        </span>
        <textarea
          className="mt-2 min-h-56 w-full rounded-md border px-3 py-2 text-xs leading-5"
          style={{
            background: 'var(--color-canvas-soft)',
            borderColor: 'var(--color-hairline)',
            color: 'var(--color-body)',
            fontFamily: 'var(--font-mono)'
          }}
          value={longTermIndex}
          onChange={(event) => onLongTermIndexChange(event.target.value)}
        />
      </label>
    </div>
  </div>
)
