import { describe, expect, it } from 'vitest'
import { normalizeProjectContextDraft } from '@shared'
import { getMissingRequirements, getStepState } from './context-setup-model'

describe('context-setup-model', () => {
  it('requires kickoff intent, target stack, and first milestone for blank workspaces', () => {
    const draft = {
      ...normalizeProjectContextDraft({
        workspaceType: 'blank',
        projectName: 'Blank',
        projectGoal: ''
      }),
      kickoffIntent: undefined
    }

    expect(getMissingRequirements(draft)).toEqual([
      'Project goal',
      'First milestone',
      'Kickoff intent',
      'Target stack'
    ])
  })

  it('accepts a complete blank workspace brief', () => {
    const draft = normalizeProjectContextDraft({
      workspaceType: 'blank',
      projectName: 'Blank',
      projectGoal: 'Build a workflow app.',
      kickoffIntent: 'desktop-app',
      firstMilestone: 'Open a local workspace.',
      primaryStack: ['Electron']
    })

    expect(getMissingRequirements(draft)).toEqual([])
  })

  it('requires stack, architecture, and verification signals for existing repositories', () => {
    const draft = normalizeProjectContextDraft({
      workspaceType: 'existing',
      projectName: 'Existing',
      projectGoal: 'Maintain a local workflow app.'
    })

    expect(getMissingRequirements(draft)).toEqual([
      'Stack or language',
      'Architecture or important paths',
      'Verification command or risk flag'
    ])
  })

  it('accepts existing repositories with stack, structure, and verification evidence', () => {
    const draft = normalizeProjectContextDraft({
      workspaceType: 'existing',
      projectName: 'Existing',
      projectGoal: 'Maintain a local workflow app.',
      primaryStack: ['TypeScript'],
      importantPaths: ['src/main'],
      verificationCommands: ['npm run typecheck']
    })

    expect(getMissingRequirements(draft)).toEqual([])
  })

  it('marks wizard steps relative to the current step', () => {
    expect(getStepState('detect', 'brief')).toBe('done')
    expect(getStepState('brief', 'brief')).toBe('active')
    expect(getStepState('review', 'brief')).toBe('pending')
  })
})
