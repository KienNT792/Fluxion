import { describe, expect, it } from 'vitest';
import {
  buildSkippedProjectContextDraft,
  createEmptyProjectContextDraft,
  formatProjectContextMarkdown,
  isProjectContextReadyForFinalSave,
  normalizeProjectContextDraft,
  resolveProjectContextStatus,
} from './context.utils';

describe('context.utils', () => {
  it('requires first milestone for blank projects on final save', () => {
    const blankDraft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('blank', 'Fluxion'),
      projectGoal: 'Build a workflow desktop app',
    });

    expect(isProjectContextReadyForFinalSave(blankDraft)).toBe(false);
    expect(resolveProjectContextStatus(blankDraft, 'final')).toBe('incomplete');
  });

  it('marks final save as ready when required context is present', () => {
    const readyDraft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('existing', 'Fluxion'),
      projectGoal: 'Build a workflow desktop app',
      architectureSummary: 'Electron main and renderer split',
      firstMilestone: 'Ship workspace context setup',
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
    expect(markdown).toContain('Prefer Windows-safe commands');
    expect(markdown).toContain('Verify with `npm run typecheck`');
    expect(markdown).toContain('# Open Questions');
  });
});
