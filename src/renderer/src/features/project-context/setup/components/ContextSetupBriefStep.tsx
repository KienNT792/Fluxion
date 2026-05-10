import React from 'react'
import type { ProjectContextDraft } from '@shared'
import { Textarea } from '@renderer/components/ui/Textarea'
import { LineListTextarea } from './LineListTextarea'

interface ContextSetupBriefStepProps {
  draft: ProjectContextDraft
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
}

const BRIEF_TEXTAREA_ROWS = 4

export const ContextSetupBriefStep: React.FC<ContextSetupBriefStepProps> = ({
  draft,
  updateDraft
}) => (
  <div
    className="grid gap-4"
    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
  >
    <div className="flex min-w-0 flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        Project goal
      </label>
      <Textarea
        value={draft.projectGoal}
        onChange={(event) => updateDraft({ projectGoal: event.target.value })}
        rows={BRIEF_TEXTAREA_ROWS}
        placeholder="What is this project trying to achieve?"
        surface="canvas"
      />
    </div>

    <div className="flex min-w-0 flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        Target users
      </label>
      <Textarea
        value={draft.targetUsers}
        onChange={(event) => updateDraft({ targetUsers: event.target.value })}
        rows={BRIEF_TEXTAREA_ROWS}
        placeholder="Who will use or review this project?"
        surface="canvas"
      />
    </div>

    <div className="flex min-w-0 flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        First milestone
      </label>
      <Textarea
        value={draft.firstMilestone}
        onChange={(event) => updateDraft({ firstMilestone: event.target.value })}
        rows={BRIEF_TEXTAREA_ROWS}
        placeholder="What should the first usable milestone deliver?"
        surface="canvas"
      />
    </div>

    <div className="flex min-w-0 flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        Architecture summary
      </label>
      <Textarea
        value={draft.architectureSummary}
        onChange={(event) => updateDraft({ architectureSummary: event.target.value })}
        rows={BRIEF_TEXTAREA_ROWS}
        placeholder="How is the project structured at a high level?"
        surface="canvas"
      />
    </div>

    <div className="min-w-0">
      <LineListTextarea
        label="Non-goals"
        values={draft.nonGoals}
        placeholder={'One non-goal per line.\nDo not add cloud sync in the first milestone.'}
        rows={BRIEF_TEXTAREA_ROWS}
        onChange={(values) => updateDraft({ nonGoals: values })}
      />
    </div>
  </div>
)
