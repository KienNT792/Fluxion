import { ProjectContextDraft } from '@shared';

function bullet(items: string[], fallback = 'Unknown'): string {
  if (items.length === 0) {
    return `- ${fallback}`;
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function codeBullet(items: string[], fallback = 'Unknown'): string {
  return bullet(items.map((item) => `\`${item}\``), fallback);
}

function renderComponents(context: ProjectContextDraft): string {
  if (context.components.length === 0) {
    return '- Unknown';
  }

  return context.components
    .map((component) => {
      const details = [
        component.type,
        component.languages.join(', '),
        component.frameworks.join(', '),
      ].filter(Boolean);
      return `- ${component.name}: \`${component.rootPath}\`${details.length ? ` (${details.join(' / ')})` : ''}`;
    })
    .join('\n');
}

function renderCommands(context: ProjectContextDraft): string {
  const commands = context.commandCatalog.length > 0
    ? context.commandCatalog
    : context.verificationCommands.map((command, index) => ({
        id: `verification-${index + 1}`,
        label: command,
        command,
        cwd: '.',
        category: 'test',
      }));

  if (commands.length === 0) {
    return '- Unknown';
  }

  return commands
    .map((command) => {
      const cwd = command.cwd === '.' ? '' : ` from \`${command.cwd}\``;
      return `- ${command.label}: \`${command.command}\`${cwd}`;
    })
    .join('\n');
}

function renderAgentInstructionSources(context: ProjectContextDraft): string {
  if (context.agentInstructionSources.length === 0) {
    return '- No existing agent instruction files were detected.';
  }

  return context.agentInstructionSources
    .map((source) => `- ${source.target}: \`${source.sourcePath}\` (${source.activation})`)
    .join('\n');
}

export function renderCodexInstructions(context: ProjectContextDraft): string {
  const projectGoal = context.projectGoal.trim() || 'Unknown';
  const targetUsers = context.targetUsers.trim() || 'Unknown';
  const architectureSummary = context.architectureSummary.trim() || 'Unknown';
  const primaryStack = context.primaryStack.length > 0 ? context.primaryStack.join(', ') : 'Unknown';

  return [
    '# Project Instructions',
    '',
    '## Project Overview',
    `- Project: ${context.projectName || 'Workspace'}`,
    `- Goal: ${projectGoal}`,
    `- Users: ${targetUsers}`,
    `- Workspace type: ${context.workspaceType}`,
    `- Context status: ${context.contextStatus}`,
    `- Primary stack: ${primaryStack}`,
    '',
    '## Architecture',
    architectureSummary,
    '',
    '## Components',
    renderComponents(context),
    '',
    '## Commands',
    renderCommands(context),
    '',
    '## Editing Rules',
    bullet(context.stableRules, 'Follow existing code style and keep changes scoped.'),
    '',
    '## Verification',
    codeBullet(context.verificationCommands, 'No verification command detected; inspect the project before claiming completion.'),
    '',
    '## Important Paths',
    codeBullet(context.importantPaths),
    '',
    '## Entrypoints',
    codeBullet(context.entrypoints),
    '',
    '## Generated Or Ignored Paths',
    codeBullet(context.generatedOrIgnoredPaths),
    '',
    '## Risk Flags',
    bullet(context.riskFlags, 'No known risk flags.'),
    '',
    '## Recommended First Actions',
    bullet(context.recommendedFirstActions, 'Inspect the relevant files before editing.'),
    '',
    '## Existing Agent Instruction Sources',
    renderAgentInstructionSources(context),
    '',
  ].join('\n');
}
