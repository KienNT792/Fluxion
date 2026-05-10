import React from 'react'
import type { ContextScanResult, ProjectContextDraft } from '@shared'
import { LineListTextarea } from './LineListTextarea'
import { ListEditor } from './ListEditor'

interface ContextSetupFocusStepProps {
  draft: ProjectContextDraft
  scanResult: ContextScanResult | null
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
}

export const ContextSetupFocusStep: React.FC<ContextSetupFocusStepProps> = ({
  draft,
  scanResult,
  updateDraft
}) => (
  <div className="space-y-5">
    <ListEditor
      label="Important paths"
      values={draft.importantPaths}
      placeholder="src/main"
      suggestions={scanResult?.discoveredPaths}
      monospace
      onChange={(values) => updateDraft({ importantPaths: values })}
    />

    <ListEditor
      label="Entrypoints"
      values={draft.entrypoints}
      placeholder="src/main/java/com/example/Application.java"
      suggestions={scanResult?.detectedFields.entrypoints}
      monospace
      onChange={(values) => updateDraft({ entrypoints: values })}
    />

    <ListEditor
      label="Current focus areas"
      values={draft.focusAreas}
      placeholder="workflow execution"
      onChange={(values) => updateDraft({ focusAreas: values })}
    />

    <LineListTextarea
      label="Risk flags"
      values={draft.riskFlags}
      placeholder={'One risk per line.\nMultiple app entrypoints were detected.'}
      rows={4}
      onChange={(values) => updateDraft({ riskFlags: values })}
    />

    <LineListTextarea
      label="Recommended first actions"
      values={draft.recommendedFirstActions}
      placeholder={'One action per line.\nReview duplicate bootstraps before feature work.'}
      rows={4}
      onChange={(values) => updateDraft({ recommendedFirstActions: values })}
    />

    <LineListTextarea
      label="Open questions"
      values={draft.openQuestions}
      placeholder={'One question per line.\nWhich runtime should be treated as default?'}
      rows={5}
      onChange={(values) => updateDraft({ openQuestions: values })}
    />
  </div>
)
