import React from 'react'
import { ProviderSettingsSummaryPayload } from '@shared'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { StatusChip } from '@renderer/components/ui/StatusChip'
import { SettingsStatusCopy } from '../lib/settings-copy'

interface OpenAiApiKeySectionProps {
  apiKeyActionLabel: string
  apiKeyInput: string
  canClearStoredKey: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  isApiKeyEditorOpen: boolean
  isLoading: boolean
  isSaving: boolean
  onClearStoredKey: () => void
  onSave: () => void
  setApiKeyInput: React.Dispatch<React.SetStateAction<string>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setIsApiKeyEditorOpen: React.Dispatch<React.SetStateAction<boolean>>
  statusCopy: SettingsStatusCopy
  summary: ProviderSettingsSummaryPayload | null
}

export const OpenAiApiKeySection: React.FC<OpenAiApiKeySectionProps> = ({
  apiKeyActionLabel,
  apiKeyInput,
  canClearStoredKey,
  inputRef,
  isApiKeyEditorOpen,
  isLoading,
  isSaving,
  onClearStoredKey,
  onSave,
  setApiKeyInput,
  setError,
  setIsApiKeyEditorOpen,
  statusCopy,
  summary
}) => (
  <section
    className="rounded-lg px-3 py-3"
    style={{
      background: 'var(--color-canvas)',
      border: '1px solid var(--color-hairline)'
    }}
  >
    <div className="flex items-center justify-between gap-3">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--color-muted)' }}
      >
        OpenAI API Key
      </span>
      <StatusChip
        tone={isLoading ? 'running' : statusCopy.tone}
        label={isLoading ? 'Loading...' : statusCopy.label}
        animate={isLoading}
      />
    </div>
    <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
      {isLoading ? 'Checking current provider settings...' : statusCopy.detail}
    </p>
    <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
      Stored outside the workspace and never written into workflow files.
      {summary?.storageMode === 'secure'
        ? ' Electron safeStorage is active for the saved key.'
        : ''}
    </p>

    {!isApiKeyEditorOpen ? (
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {canClearStoredKey && (
          <Button variant="secondary" size="sm" onClick={onClearStoredKey} disabled={isSaving}>
            Clear Stored Key
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setError(null)
            setIsApiKeyEditorOpen(true)
          }}
          disabled={isSaving}
        >
          {apiKeyActionLabel}
        </Button>
      </div>
    ) : (
      <div className="mt-3">
        <label
          className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--color-muted)' }}
        >
          OpenAI API Key
        </label>
        <Input
          ref={inputRef}
          type="password"
          value={apiKeyInput}
          onChange={(event) => setApiKeyInput(event.target.value)}
          placeholder="sk-..."
          surface="card"
          font="mono"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
          Optional. Saving a new key replaces the stored one immediately.
        </p>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setApiKeyInput('')
              setIsApiKeyEditorOpen(false)
              setError(null)
            }}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Key'}
          </Button>
        </div>
      </div>
    )}
  </section>
)
