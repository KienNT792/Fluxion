import * as fs from 'fs/promises';
import * as path from 'path';
import { ContextScanResult, ContextSourceEvidence, ProjectContextField } from '@shared';

interface PackageJsonShape {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const TOP_LEVEL_SIGNAL_DIRS = ['src', 'app', 'packages', 'docs'];
const SCANNED_FILE_CANDIDATES = [
  'README.md',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.web.json',
  'AGENTS.md',
] as const;

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function addEvidence(
  evidence: ContextSourceEvidence[],
  field: ProjectContextField,
  sourcePath: string,
  confidence: ContextSourceEvidence['confidence'],
  note?: string
): void {
  evidence.push({ field, sourcePath, confidence, note });
}

function takeFirstParagraph(readme: string): string {
  const lines = readme
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const paragraphLines = lines.filter((line) => !line.startsWith('#'));

  return paragraphLines[0] ?? '';
}

function inferPrimaryStack(pkg: PackageJsonShape, scannedFiles: string[]): string[] {
  const packages = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const stack: string[] = [];

  if (scannedFiles.some((file) => file.startsWith('tsconfig'))) {
    stack.push('TypeScript');
  }
  if (packages.has('electron') || packages.has('electron-vite')) {
    stack.push('Electron');
  }
  if (packages.has('react')) {
    stack.push('React');
  }
  if (packages.has('vite') || packages.has('electron-vite')) {
    stack.push('Vite');
  }
  if (packages.has('zustand')) {
    stack.push('Zustand');
  }
  if (packages.has('tailwindcss') || packages.has('@tailwindcss/vite')) {
    stack.push('Tailwind CSS');
  }

  return [...new Set(stack)];
}

function inferArchitectureSummary(discoveredPaths: string[]): string {
  const hasMain = discoveredPaths.includes('src/main');
  const hasPreload = discoveredPaths.includes('src/preload');
  const hasRenderer = discoveredPaths.includes('src/renderer');
  const hasCore = discoveredPaths.includes('src/core');

  if (hasMain && hasPreload && hasRenderer && hasCore) {
    return 'Electron app split into main, preload, renderer, and shared core layers.';
  }

  if (discoveredPaths.includes('src')) {
    return 'Source code is organized under src/ with repository-specific conventions.';
  }

  return '';
}

function inferVerificationCommands(pkg: PackageJsonShape): string[] {
  const scripts = pkg.scripts ?? {};
  return ['typecheck', 'test', 'lint', 'build', 'smoke:win']
    .filter((scriptName) => typeof scripts[scriptName] === 'string')
    .map((scriptName) => `npm run ${scriptName}`);
}

function inferImportantPaths(discoveredPaths: string[]): string[] {
  const preferred = ['src', 'src/main', 'src/preload', 'src/renderer', 'src/core', 'docs'];
  const result = preferred.filter((item) => discoveredPaths.includes(item));
  if (result.length > 0) {
    return result;
  }

  return discoveredPaths.slice(0, 4);
}

async function discoverTopLevelPaths(workspacePath: string): Promise<string[]> {
  const discoveredPaths: string[] = [];

  for (const directory of TOP_LEVEL_SIGNAL_DIRS) {
    const fullPath = path.join(workspacePath, directory);
    if (!(await exists(fullPath))) {
      continue;
    }

    discoveredPaths.push(directory);
  }

  for (const nestedPath of ['src/main', 'src/preload', 'src/renderer', 'src/core']) {
    if (await exists(path.join(workspacePath, nestedPath))) {
      discoveredPaths.push(nestedPath);
    }
  }

  return discoveredPaths;
}

function inferTargetUsers(readme: string): string {
  const lines = readme.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.toLowerCase().includes('aimed at'));
  if (startIndex < 0) {
    return '';
  }

  const bullets: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';
    if (!line) {
      break;
    }
    if (!line.startsWith('-')) {
      continue;
    }
    bullets.push(line.replace(/^-+\s*/, ''));
  }

  return bullets.join(' ');
}

export async function scanWorkspaceContext(workspacePath: string): Promise<ContextScanResult> {
  const resolvedWorkspacePath = path.resolve(workspacePath);
  const projectNameFallback = path.basename(resolvedWorkspacePath) || 'Workspace';
  const scannedFiles: string[] = [];
  const sourceEvidence: ContextSourceEvidence[] = [];
  const discoveredPaths = await discoverTopLevelPaths(resolvedWorkspacePath);

  let packageJson: PackageJsonShape = {};
  let readme = '';

  for (const candidate of SCANNED_FILE_CANDIDATES) {
    const absolutePath = path.join(resolvedWorkspacePath, candidate);
    if (!(await exists(absolutePath))) {
      continue;
    }

    scannedFiles.push(candidate);

    if (candidate === 'package.json') {
      try {
        packageJson = JSON.parse((await fs.readFile(absolutePath, 'utf-8')) as string);
      } catch {
        packageJson = {};
      }
    } else if (candidate === 'README.md') {
      readme = (await readTextIfExists(absolutePath)) ?? '';
    }
  }

  const hasInstructions = scannedFiles.includes('AGENTS.md');
  const hasRepoSignals = scannedFiles.length > 0 || discoveredPaths.length > 0;
  const workspaceType = hasInstructions
    ? 'existing_with_instructions'
    : hasRepoSignals
      ? 'existing'
      : 'blank';
  const projectName = packageJson.name?.trim() || projectNameFallback;
  const projectGoal =
    packageJson.description?.trim() || takeFirstParagraph(readme) || '';
  const primaryStack = inferPrimaryStack(packageJson, scannedFiles);
  const architectureSummary = inferArchitectureSummary(discoveredPaths);
  const verificationCommands = inferVerificationCommands(packageJson);
  const importantPaths = inferImportantPaths(discoveredPaths);
  const targetUsers = inferTargetUsers(readme);

  addEvidence(
    sourceEvidence,
    'projectName',
    packageJson.name ? 'package.json' : 'workspace',
    packageJson.name ? 'high' : 'medium',
    packageJson.name ? 'Detected from package metadata.' : 'Using the workspace folder name.'
  );
  if (projectGoal) {
    addEvidence(
      sourceEvidence,
      'projectGoal',
      packageJson.description ? 'package.json' : 'README.md',
      packageJson.description ? 'high' : 'medium',
      'Detected from repository description.'
    );
  }
  if (primaryStack.length > 0) {
    addEvidence(
      sourceEvidence,
      'primaryStack',
      'package.json',
      'high',
      'Derived from dependencies and configuration files.'
    );
  }
  if (architectureSummary) {
    addEvidence(
      sourceEvidence,
      'architectureSummary',
      discoveredPaths.includes('src/main') ? 'src/' : 'workspace',
      discoveredPaths.includes('src/main') ? 'high' : 'medium',
      'Detected from top-level source structure.'
    );
  }
  if (verificationCommands.length > 0) {
    addEvidence(
      sourceEvidence,
      'verificationCommands',
      'package.json',
      'high',
      'Derived from available npm scripts.'
    );
  }
  if (importantPaths.length > 0) {
    addEvidence(
      sourceEvidence,
      'importantPaths',
      importantPaths[0] ?? 'workspace',
      'medium',
      'Suggested from top-level repository structure.'
    );
  }
  if (targetUsers) {
    addEvidence(
      sourceEvidence,
      'targetUsers',
      'README.md',
      'medium',
      'Parsed from README audience section.'
    );
  }
  if (workspaceType === 'existing_with_instructions') {
    addEvidence(
      sourceEvidence,
      'workspaceType',
      'AGENTS.md',
      'high',
      'Workspace already contains project instructions.'
    );
  }

  const unresolvedFields: ProjectContextField[] = [
    !projectGoal && 'projectGoal',
    !targetUsers && 'targetUsers',
    primaryStack.length === 0 && 'primaryStack',
    !architectureSummary && 'architectureSummary',
    verificationCommands.length === 0 && 'verificationCommands',
    importantPaths.length === 0 && 'importantPaths',
    'firstMilestone',
    'stableRules',
    'focusAreas',
    'openQuestions',
  ].filter(Boolean) as ProjectContextField[];

  return {
    workspaceType,
    projectName,
    detectedFields: {
      workspaceType,
      projectName,
      projectGoal,
      targetUsers,
      primaryStack,
      architectureSummary,
      verificationCommands,
      importantPaths,
    },
    sourceEvidence,
    unresolvedFields,
    scannedFiles,
    discoveredPaths,
  };
}
