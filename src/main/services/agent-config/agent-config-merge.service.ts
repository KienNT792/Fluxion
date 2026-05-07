import * as fs from 'fs/promises';
import * as path from 'path';
import {
  AgentConfigApplyPreviewResult,
  AgentConfigExportPreview,
  AgentConfigFileOperation,
} from '@shared';

const MARKER_PATTERNS = {
  markdown: {
    start: '<!-- BEGIN FLUXION CONTEXT -->',
    end: '<!-- END FLUXION CONTEXT -->',
  },
  toml: {
    start: '# BEGIN FLUXION CODEX CONFIG',
    end: '# END FLUXION CODEX CONFIG',
  },
} as const;

export function wrapMarkdownFluxionSection(content: string): string {
  return [
    MARKER_PATTERNS.markdown.start,
    content.trim(),
    MARKER_PATTERNS.markdown.end,
    '',
  ].join('\n');
}

export function wrapTomlFluxionSection(content: string): string {
  return [
    MARKER_PATTERNS.toml.start,
    content.trim(),
    MARKER_PATTERNS.toml.end,
    '',
  ].join('\n');
}

export function mergeMarkedSection(
  existingContent: string,
  nextSection: string,
  markerType: keyof typeof MARKER_PATTERNS
): { content: string; action: 'update' | 'appendSection' } {
  const markers = MARKER_PATTERNS[markerType];
  const startIndex = existingContent.indexOf(markers.start);
  const endIndex = existingContent.indexOf(markers.end);

  if (startIndex >= 0 && endIndex > startIndex) {
    const sectionEnd = endIndex + markers.end.length;
    return {
      action: 'update',
      content: `${existingContent.slice(0, startIndex)}${nextSection.trimEnd()}${existingContent.slice(sectionEnd)}`,
    };
  }

  const separator = existingContent.trim().length > 0 ? '\n\n' : '';
  return {
    action: 'appendSection',
    content: `${existingContent.trimEnd()}${separator}${nextSection}`,
  };
}

export async function readExistingFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function assertWorkspaceBound(workspacePath: string, absolutePath: string): void {
  const workspaceRoot = path.resolve(workspacePath);
  const targetPath = path.resolve(absolutePath);
  const relativePath = path.relative(workspaceRoot, targetPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Refusing to write outside the workspace: ${absolutePath}`);
  }
}

export class AgentConfigMergeService {
  public async applyPreview(
    preview: AgentConfigExportPreview
  ): Promise<AgentConfigApplyPreviewResult> {
    const applied: AgentConfigFileOperation[] = [];
    const skipped: AgentConfigFileOperation[] = [];

    for (const operation of preview.operations) {
      assertWorkspaceBound(preview.workspacePath, operation.absolutePath);

      if (operation.action === 'skip' || operation.action === 'conflict') {
        skipped.push(operation);
        continue;
      }

      await fs.mkdir(path.dirname(operation.absolutePath), { recursive: true });
      await fs.writeFile(operation.absolutePath, operation.content, 'utf-8');
      applied.push(operation);
    }

    return { applied, skipped };
  }
}

export const agentConfigMergeService = new AgentConfigMergeService();
