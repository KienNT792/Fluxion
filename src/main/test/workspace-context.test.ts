import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import matter from 'gray-matter';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyProjectContextDraft, normalizeProjectContextDraft } from '@shared';
import { memoryManager } from '../services/memory-manager';
import { workspaceService } from '../services/workspace.service';

describe('workspaceService project context', () => {
  let workspacePath: string;

  afterEach(async () => {
    if (workspacePath) {
      await rm(workspacePath, { recursive: true, force: true });
    }
  });

  it('saves project context.json and global-context.md together', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-save-'));
    const draft = normalizeProjectContextDraft({
      ...createEmptyProjectContextDraft('existing', 'Fluxion'),
      projectGoal: 'Build a Windows-first workflow desktop app',
      targetUsers: 'Developers running local agent workflows',
      primaryStack: ['Electron', 'React', 'TypeScript'],
      architectureSummary: 'Split across main, preload, and renderer layers',
      firstMilestone: 'Ship context setup',
      stableRules: ['Prefer Windows-safe commands'],
      verificationCommands: ['npm run typecheck'],
      importantPaths: ['src/main', 'src/renderer'],
      focusAreas: ['workflow execution'],
      openQuestions: ['How should retries be surfaced?'],
    });

    const result = await workspaceService.saveProjectContext(workspacePath, draft, 'final');
    const contextJson = JSON.parse(
      await readFile(join(workspacePath, '.fluxion', 'context.json'), 'utf8')
    );
    const globalContext = matter(
      await readFile(join(workspacePath, '.fluxion', 'memory', 'global-context.md'), 'utf8')
    );
    const compiledContext = await memoryManager.compileContext(workspacePath, 'workflow-1', []);

    expect(result.contextStatus).toBe('ready');
    expect(contextJson.projectGoal).toBe('Build a Windows-first workflow desktop app');
    expect(globalContext.content).toContain('# Project Brief');
    expect(globalContext.content).toContain('Prefer Windows-safe commands');
    expect(compiledContext).toContain('[GLOBAL CONTEXT]');
    expect(compiledContext).toContain('Build a Windows-first workflow desktop app');
  });

  it('maps legacy context files into legacy status until resaved', async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-context-legacy-'));
    await mkdir(join(workspacePath, '.fluxion'), { recursive: true });
    await writeFile(
      join(workspacePath, '.fluxion', 'context.json'),
      JSON.stringify(
        {
          objective: 'Migrate the desktop onboarding flow',
          language: 'TypeScript, React',
          architecture: 'Electron main and renderer',
          styleGuide: 'Prefer Windows-safe commands',
          focusAreas: 'Context setup, workflow runtime',
        },
        null,
        2
      ),
      'utf8'
    );

    const context = await workspaceService.getContext(workspacePath);

    expect(context).not.toBeNull();
    expect(context?.contextStatus).toBe('legacy');
    expect(context?.projectGoal).toBe('Migrate the desktop onboarding flow');
    expect(context?.primaryStack).toEqual(['TypeScript', 'React']);
  });
});
