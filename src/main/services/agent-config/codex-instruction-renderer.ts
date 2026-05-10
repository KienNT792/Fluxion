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

function renderArchitectureBoundaries(context: ProjectContextDraft): string {
  const boundaries = [
    context.architectureSummary.trim(),
    ...context.moduleBoundaries,
    ...context.components.slice(0, 6).map(
      (component) => `${component.name}: \`${component.rootPath}\` (${component.type})`
    ),
  ].filter(Boolean);

  return bullet(boundaries, 'Unknown');
}

export function renderCodexInstructions(context: ProjectContextDraft): string {
  const projectGoal = context.projectGoal.trim() || 'Unknown';
  const targetUsers = context.targetUsers.trim() || 'Unknown';
  const primaryStack = context.primaryStack.length > 0 ? context.primaryStack.join(', ') : 'Unknown';

  return [
    '# Project Instructions',
    '',
    '## Project Overview',
    `- Project: ${context.projectName || 'Workspace'}`,
    `- Goal: ${projectGoal}`,
    `- Users: ${targetUsers}`,
    `- Primary stack: ${primaryStack}`,
    '',
    '## Architecture Boundaries',
    renderArchitectureBoundaries(context),
    '',
    '## Commands',
    renderCommands(context),
    '',
    '## Durable Rules',
    bullet(context.stableRules, 'Follow existing code style and keep changes scoped.'),
    '',
    '## Important Paths',
    codeBullet(context.importantPaths),
    '',
    '## Risk Flags',
    bullet(context.riskFlags, 'No known risk flags.'),
    '',
    '## Existing Instruction Sources',
    renderAgentInstructionSources(context),
    '',
  ].join('\n');
}
