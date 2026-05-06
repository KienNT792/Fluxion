import { existsSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = process.cwd();

if (process.platform !== 'win32') {
  console.error('[smoke:win] This smoke script is intended for Windows.');
  process.exit(1);
}

function runStep(label, command, args) {
  console.log(`\n[smoke:win] ${label}`);
  const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', command, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`[smoke:win] Failed to start ${label}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertExists(targetPath, description) {
  if (!existsSync(targetPath)) {
    console.error(`[smoke:win] Missing ${description}: ${targetPath}`);
    process.exit(1);
  }
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

runStep('Typecheck', npmCommand, ['run', 'typecheck']);
runStep('Tests', npmCommand, ['run', 'test']);
runStep('Production build', npmCommand, ['run', 'build']);
runStep('Windows unpacked packaging', 'npx.cmd', [
  'electron-builder',
  '--dir',
  '--config.win.signAndEditExecutable=false',
]);

const unpackedDir = path.join(repoRoot, 'dist', 'win-unpacked');
const executablePath = path.join(unpackedDir, 'fluxion.exe');
const asarPath = path.join(unpackedDir, 'resources', 'app.asar');

assertExists(unpackedDir, 'win-unpacked directory');
assertExists(executablePath, 'Fluxion executable');
assertExists(asarPath, 'packaged app archive');

console.log('\n[smoke:win] Windows unpacked build smoke passed.');
