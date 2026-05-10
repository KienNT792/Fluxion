import React from 'react'
import type { ProjectContextDraft } from '@shared'
import { Textarea } from '@renderer/components/ui/Textarea'
import { LineListTextarea } from './LineListTextarea'

interface ContextSetupBriefStepProps {
  draft: ProjectContextDraft
  updateDraft: (patch: Partial<ProjectContextDraft>) => void
}

export const ContextSetupBriefStep: React.FC<ContextSetupBriefStepProps> = ({
  draft,
  updateDraft
}) => (
  <div className="space-y-5">
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        Project goal
      </label>
      <Textarea
        value={draft.projectGoal}
        onChange={(event) => updateDraft({ projectGoal: event.target.value })}
        rows={4}
        placeholder="What is this project trying to achieve?"
        surface="canvas"
      />
    </div>

    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        Target users
      </label>
      <Textarea
        value={draft.targetUsers}
        onChange={(event) => updateDraft({ targetUsers: event.target.value })}
        rows={3}
        placeholder="Who will use or review this project?"
        surface="canvas"
      />
    </div>

    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        Architecture summary
      </label>
      <Textarea
        value={draft.architectureSummary}
        onChange={(event) => updateDraft({ architectureSummary: event.target.value })}
        rows={4}
        placeholder="How is the project structured at a high level?"
        surface="canvas"
      />
    </div>

    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        First milestone
      </label>
      <Textarea
        value={draft.firstMilestone}
        onChange={(event) => updateDraft({ firstMilestone: event.target.value })}
        rows={3}
        placeholder="What should the first usable milestone deliver?"
        surface="canvas"
      />
    </div>

    <LineListTextarea
      label="Non-goals"
      values={draft.nonGoals}
      placeholder={'One non-goal per line.\nDo not add cloud sync in the first milestone.'}
      rows={4}
      onChange={(values) => updateDraft({ nonGoals: values })}
    />
  </div>
)
