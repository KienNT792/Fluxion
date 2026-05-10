import { describe, expect, it } from 'vitest'
import {
  getAgentNodePromptPreview,
  getAgentNodeStatusMeta,
  getAgentNodeTitle,
  getAgentNodeTitleSource,
  getAgentNodeVisualState
} from './agent-node-display'

describe('agent node display helpers', () => {
  it('uses label, prompt, then model display as title fallback', () => {
    expect(
      getAgentNodeTitle(
        {
          label: 'Review current diff',
          model: 'gpt-5.5',
          prompt: 'Ignored prompt'
        },
        'GPT-5.5'
      )
    ).toBe('Review current diff')

    expect(
      getAgentNodeTitle(
        {
          model: 'gpt-5.5',
          prompt: '\n  Inspect the current diff\nSummarize risks'
        },
        'GPT-5.5'
      )
    ).toBe('Inspect the current diff')

    expect(getAgentNodeTitle({ model: 'gpt-5.5', prompt: '' }, 'GPT-5.5')).toBe('GPT-5.5')
  })

  it('builds a two-line prompt preview from meaningful lines', () => {
    expect(getAgentNodePromptPreview('\nFirst task\n\nSecond task\nThird task')).toBe(
      'First task\nSecond task'
    )
  })

  it('can skip the prompt line already used as title', () => {
    expect(
      getAgentNodePromptPreview('\nFirst task\n\nSecond task\nThird task', {
        skipFirstMeaningfulLine: true
      })
    ).toBe('Second task\nThird task')
    expect(getAgentNodePromptPreview('Only task', { skipFirstMeaningfulLine: true })).toBe('')
  })

  it('reports the title source', () => {
    expect(getAgentNodeTitleSource({ label: 'Named node', prompt: 'Prompt' })).toBe('label')
    expect(getAgentNodeTitleSource({ prompt: 'Prompt' })).toBe('prompt')
    expect(getAgentNodeTitleSource({ model: 'gpt-5.5', prompt: '' })).toBe('model')
  })

  it('prioritizes runtime state over selected state', () => {
    expect(getAgentNodeVisualState('running', true)).toBe('running')
    expect(getAgentNodeVisualState('idle', true)).toBe('selected')
    expect(getAgentNodeVisualState('idle', false)).toBe('idle')
  })

  it('returns compact status labels', () => {
    expect(getAgentNodeStatusMeta('paused').label).toBe('Review')
    expect(getAgentNodeStatusMeta('completed').label).toBe('Done')
  })
})
