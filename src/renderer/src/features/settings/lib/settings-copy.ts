import { ProviderSettingsSummaryPayload } from '@shared'
import type { StatusChipTone } from '@renderer/components/ui/StatusChip'

export interface CommandRow {
  id: string
  label: string
  command: string
}

export const CODEX_COMMANDS: CommandRow[] = [
  { id: 'install', label: 'Install', command: 'npm i -g @openai/codex' },
  { id: 'login', label: 'Login', command: 'codex login' },
  { id: 'check', label: 'Check', command: 'codex login status' }
]

export interface SettingsStatusCopy {
  label: string
  detail: string
  tone: StatusChipTone
}

export function getStatusCopy(summary: ProviderSettingsSummaryPayload | null): SettingsStatusCopy {
  if (!summary || !summary.openaiApiKeyConfigured) {
    return {
      label: 'Not configured',
      detail:
        'Not required for Codex CLI workflows. Add a key only for OpenAI API provider features.',
      tone: 'idle'
    }
  }

  if (summary.openaiApiKeySource === 'env') {
    return {
      label: 'Environment',
      detail: `Using ${summary.openaiApiKeyMasked ?? 'OPENAI_API_KEY'} from the process environment.`,
      tone: 'warning'
    }
  }

  return {
    label: summary.storageMode === 'secure' ? 'Stored Securely' : 'Stored Locally',
    detail: `Using ${summary.openaiApiKeyMasked ?? 'saved key'} from Fluxion settings.`,
    tone: 'success'
  }
}

export function getCodexCopy(
  tone: 'ready' | 'warning' | 'blocked',
  detail: string
): {
  title: string
  detail: string
  tone: StatusChipTone
} {
  if (tone === 'ready') {
    return {
      title: 'Codex CLI ready',
      detail: 'Codex CLI is ready. Fluxion can run workflows through your local Codex login.',
      tone: 'success'
    }
  }

  if (tone === 'blocked') {
    return {
      title: 'Codex setup needed',
      detail,
      tone: 'error'
    }
  }

  return {
    title: 'Codex warning',
    detail,
    tone: 'warning'
  }
}
