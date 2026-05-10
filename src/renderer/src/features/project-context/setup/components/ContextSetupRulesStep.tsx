import React from 'react'
import type { ContextScanResult, ProjectContextDraft } from '@shared'
import { LineListTextarea } from './LineListTextarea'
import { ListEditor } from './ListEditor'

interface ContextSetupRulesStepProps {
  draft: ProjectContextDraft
  scanResult: ContextScanResult | null
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
}

export const ContextSetupRulesStep: React.FC<ContextSetupRulesStepProps> = ({
  draft,
  scanResult,
  updateDraft
}) => (
  <div className="space-y-5">
    <ListEditor
      label="Primary stack"
      values={draft.primaryStack}
      placeholder="TypeScript"
      suggestions={scanResult?.detectedFields.primaryStack}
      onChange={(values) => updateDraft({ primaryStack: values })}
    />

    <ListEditor
      label="Languages"
      values={draft.languages}
      placeholder="Java"
      suggestions={scanResult?.detectedFields.languages}
      onChange={(values) => updateDraft({ languages: values })}
    />

    <ListEditor
      label="Frameworks"
      values={draft.frameworks}
      placeholder="Spring Boot"
      suggestions={scanResult?.detectedFields.frameworks}
      onChange={(values) => updateDraft({ frameworks: values })}
    />

    <ListEditor
      label="Package managers"
      values={draft.packageManagers}
      placeholder="Maven"
      suggestions={scanResult?.detectedFields.packageManagers}
      onChange={(values) => updateDraft({ packageManagers: values })}
    />

    <ListEditor
      label="Verification commands"
      values={draft.verificationCommands}
      placeholder="npm run typecheck"
      hint="These commands should be safe defaults before agents claim done."
      suggestions={scanResult?.detectedFields.verificationCommands}
      monospace
      onChange={(values) => updateDraft({ verificationCommands: values })}
    />

    <LineListTextarea
      label="Stable rules"
      values={draft.stableRules}
      placeholder={
        'One rule per line.\nPrefer Windows-safe commands.\nKeep runtime logic out of the renderer.'
      }
      hint="Rules that agents should consistently follow."
      rows={5}
      onChange={(values) => updateDraft({ stableRules: values })}
    />
  </div>
)
