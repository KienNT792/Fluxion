import { describe, expect, it } from 'vitest';
import {
  buildSkippedProjectContextDraft,
  createEmptyProjectContextDraft,
  formatProjectContextMarkdown,
  isProjectContextReadyForFinalSave,
  normalizeProjectContextDraft,
  resolveProjectContextStatus,
  shouldShowIncompleteContextBanner,
} from './context.utils';

describe('context.utils', () => {
  it('requires first milestone for blank projects on final save', () => {
    const blankDraft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('blank', 'Fluxion'),
      projectGoal: 'Build a workflow desktop app',
      primaryStack: ['Electron'],
    });

    expect(isProjectContextReadyForFinalSave(blankDraft)).toBe(false);
    expect(resolveProjectContextStatus(blankDraft, 'final')).toBe('incomplete');
  });

  it('marks final save as ready when required context is present', () => {
    const readyDraft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('existing', 'Fluxion'),
      projectGoal: 'Build a workflow desktop app',
      primaryStack: ['Electron', 'React', 'TypeScript'],
      architectureSummary: 'Electron main and renderer split',
      firstMilestone: 'Ship workspace context setup',
      verificationCommands: ['npm run typecheck'],
    });

    expect(isProjectContextReadyForFinalSave(readyDraft)).toBe(true);
    expect(resolveProjectContextStatus(readyDraft, 'final')).toBe('ready');
  });

  it('builds skipped drafts as incomplete and adds an open question by default', () => {
    const skippedDraft = buildSkippedProjectContextDraft({}, 'blank', 'Fluxion');

    expect(skippedDraft.contextStatus).toBe('incomplete');
    expect(skippedDraft.openQuestions.length).toBeGreaterThan(0);
  });

  it('renders project context markdown with stable sections', () => {
    const markdown = formatProjectContextMarkdown(
      normalizeProjectContextDraft({
        ...createEmptyProjectContextDraft('existing', 'Fluxion'),
        projectGoal: 'Build a workflow desktop app',
        targetUsers: 'Developers running local agent workflows',
        primaryStack: ['Electron', 'React', 'TypeScript'],
        architectureSummary: 'Split across main, preload, and renderer layers',
        firstMilestone: 'Ship project context setup',
        stableRules: ['Prefer Windows-safe commands'],
        verificationCommands: ['npm run typecheck'],
        importantPaths: ['src/main', 'src/renderer'],
        focusAreas: ['workflow execution'],
        openQuestions: ['How should retries be surfaced?'],
        contextStatus: 'ready',
      })
    );

    expect(markdown).toContain('# Project Brief');
    expect(markdown).toContain('# Stable Rules');
    expect(markdown).toContain('# Verification');
    expect(markdown).toContain('Prefer Windows-safe commands');
    expect(markdown).toContain('Verify with `npm run typecheck`');
    expect(markdown).toContain('# Open Questions');
  });

  it('normalizes context onboarding metadata without rendering it into markdown', () => {
    const draft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('existing', 'Fluxion'),
      contextOnboarding: {
        initialPromptDismissedAt: '2026-05-07T01:00:00.000Z',
        incompleteBannerDismissedAt: '2026-05-07T02:00:00.000Z',
        legacyWorkflowDecision: 'keep',
        legacyWorkflowDecisionAt: '2026-05-07T03:00:00.000Z',
      },
    });
    const markdown = formatProjectContextMarkdown(draft);

    expect(draft.contextOnboarding).toEqual({
      initialPromptDismissedAt: '2026-05-07T01:00:00.000Z',
      incompleteBannerDismissedAt: '2026-05-07T02:00:00.000Z',
      legacyWorkflowDecision: 'keep',
      legacyWorkflowDecisionAt: '2026-05-07T03:00:00.000Z',
    });
    expect(markdown).not.toContain('contextOnboarding');
    expect(markdown).not.toContain('legacyWorkflowDecision');
  });

  it('shows incomplete context banner again after the context is saved later', () => {
    const dismissedDraft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('existing', 'Fluxion'),
      contextStatus: 'incomplete',
      lastReviewedAt: '2026-05-07T01:00:00.000Z',
      contextOnboarding: {
        incompleteBannerDismissedAt: '2026-05-07T02:00:00.000Z',
      },
    });
    const updatedDraft = normalizeProjectContextDraft({
      ...dismissedDraft,
      lastReviewedAt: '2026-05-07T03:00:00.000Z',
    });

    expect(shouldShowIncompleteContextBanner('incomplete', dismissedDraft, false)).toBe(false);
    expect(shouldShowIncompleteContextBanner('incomplete', updatedDraft, false)).toBe(true);
    expect(shouldShowIncompleteContextBanner('ready', updatedDraft, false)).toBe(false);
    expect(shouldShowIncompleteContextBanner('incomplete', updatedDraft, true)).toBe(false);
  });
});
