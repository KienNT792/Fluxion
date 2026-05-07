import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_CAPTURE_CHARS = 256 * 1024;
const MAX_EVENT_PREVIEW_COUNT = 5;
const MAX_EVENT_PREVIEW_CHARS = 8 * 1024;

const CORRELATION_KEYS = new Set([
  'id',
  'request_id',
  'requestId',
  'correlation_id',
  'correlationId',
  'tool_call_id',
  'toolCallId',
  'call_id',
  'callId',
]);

const REPLY_CHANNEL_KEYS = new Set([
  'reply',
  'reply_channel',
  'replyChannel',
  'response_channel',
  'responseChannel',
  'approval_response',
  'approvalResponse',
  'stdin_protocol',
  'stdinProtocol',
]);

function appendCappedText(current, chunk) {
  if (current.length >= MAX_CAPTURE_CHARS) {
    return current;
  }

  const next = current + chunk;
  return next.length > MAX_CAPTURE_CHARS
    ? next.slice(0, MAX_CAPTURE_CHARS)
    : next;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getEventType(event) {
  if (!isPlainObject(event)) {
    return undefined;
  }

  for (const key of ['type', 'event', 'kind', 'name']) {
    const value = event[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function hasKeyContainingApproval(value, depth = 0) {
  if (depth > 4 || !isPlainObject(value)) {
    return false;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key.toLowerCase().includes('approval')) {
      return true;
    }

    if (hasKeyContainingApproval(child, depth + 1)) {
      return true;
    }
  }

  return false;
}

function hasKnownKey(value, keys, depth = 0) {
  if (depth > 4 || !isPlainObject(value)) {
    return false;
  }

  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key)) {
      return true;
    }

    if (hasKnownKey(child, keys, depth + 1)) {
      return true;
    }
  }

  return false;
}

export function parseNdjsonLines(text) {
  const events = [];
  const invalidLines = [];
  let lineCount = 0;

  for (const line of text.split(/\r?\n/)) {
    const normalizedLine = line.replace(/\r$/, '');
    if (normalizedLine.trim().length === 0) {
      continue;
    }

    lineCount += 1;

    try {
      events.push(JSON.parse(normalizedLine));
    } catch {
      if (invalidLines.length < 20) {
        invalidLines.push(normalizedLine.slice(0, 500));
      }
    }
  }

  return {
    events,
    invalidLines,
    lineCount,
  };
}

export function isStructuredApprovalRequest(event) {
  const eventType = getEventType(event)?.toLowerCase() ?? '';
  return eventType.includes('approval') || hasKeyContainingApproval(event);
}

export function analyzeApprovalProtocolEvents(
  events,
  confirmations = {
    approveDeterministic: false,
    rejectDeterministic: false,
  }
) {
  const approvalEvents = events.filter(isStructuredApprovalRequest);
  const observedEventTypes = [
    ...new Set(events.map((event) => getEventType(event) ?? 'unknown')),
  ].slice(0, 50);
  const hasStructuredApprovalRequest = approvalEvents.length > 0;
  const hasCorrelationId = approvalEvents.some((event) => hasKnownKey(event, CORRELATION_KEYS));
  const hasProgrammaticReplyChannel = approvalEvents.some((event) =>
    hasKnownKey(event, REPLY_CHANNEL_KEYS)
  );
  const approveDeterministic = Boolean(confirmations.approveDeterministic);
  const rejectDeterministic = Boolean(confirmations.rejectDeterministic);

  return {
    observedEventTypes,
    hasStructuredApprovalRequest,
    hasCorrelationId,
    hasProgrammaticReplyChannel,
    approveDeterministic,
    rejectDeterministic,
    status:
      hasStructuredApprovalRequest
      && hasCorrelationId
      && hasProgrammaticReplyChannel
      && approveDeterministic
      && rejectDeterministic
        ? 'supported'
        : 'unsupported',
    rawEventPreview: approvalEvents.length > 0
      ? approvalEvents.slice(0, MAX_EVENT_PREVIEW_COUNT).map(capEventPreview)
      : events.slice(0, MAX_EVENT_PREVIEW_COUNT).map(capEventPreview),
  };
}

function capEventPreview(event) {
  const serialized = JSON.stringify(event);
  if (serialized.length <= MAX_EVENT_PREVIEW_CHARS) {
    return event;
  }

  return {
    previewTruncated: true,
    value: serialized.slice(0, MAX_EVENT_PREVIEW_CHARS),
  };
}

async function pathExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveNodeScriptForShim(shimPath) {
  const baseDirectory = dirname(shimPath);
  const scriptPath = join(baseDirectory, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');

  if (!(await pathExists(scriptPath))) {
    return null;
  }

  const localNodePath = join(baseDirectory, 'node.exe');
  const nodeCommand = (await pathExists(localNodePath)) ? localNodePath : 'node';

  return {
    command: nodeCommand,
    argsPrefix: [scriptPath],
    displayCommand: `${nodeCommand} ${scriptPath}`,
  };
}

function whereCodex() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve([]);
      return;
    }

    const child = spawn('where.exe', ['codex'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';

    child.stdout?.on('data', (chunk) => {
      stdout = appendCappedText(stdout, chunk.toString());
    });
    child.once('error', () => resolve([]));
    child.once('close', () => {
      resolve(
        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      );
    });
  });
}

async function resolveCodexCandidates() {
  if (process.env.CODEX_COMMAND) {
    return [
      {
        command: process.env.CODEX_COMMAND,
        argsPrefix: [],
        displayCommand: process.env.CODEX_COMMAND,
      },
    ];
  }

  if (process.platform !== 'win32') {
    return [{ command: 'codex', argsPrefix: [], displayCommand: 'codex' }];
  }

  const candidates = await whereCodex();
  const resolved = [];

  for (const candidate of candidates) {
    const extension = extname(candidate).toLowerCase();

    if (extension === '.exe') {
      resolved.push({
        command: candidate,
        argsPrefix: [],
        displayCommand: candidate,
      });
      continue;
    }

    const nodeScriptCandidate = await resolveNodeScriptForShim(candidate);
    if (nodeScriptCandidate) {
      resolved.push(nodeScriptCandidate);
    }

    if (extension === '.cmd' || extension === '.bat') {
      resolved.push({
        command: process.env.ComSpec || 'cmd.exe',
        argsPrefix: ['/d', '/c', 'call', candidate],
        displayCommand: `cmd.exe /d /c call ${candidate}`,
      });
    }
  }

  return dedupeCandidates(resolved);
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const unique = [];

  for (const candidate of candidates) {
    const key = [candidate.command, ...candidate.argsPrefix].join('\0');
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

function buildCodexExecArgs(workspacePath, outputLastMessagePath) {
  return [
    'exec',
    '--json',
    '--cd',
    workspacePath,
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--config',
    'approval_policy=on-request',
    '--output-last-message',
    outputLastMessagePath,
    '-',
  ];
}

function killProcessTree(child) {
  return new Promise((resolve) => {
    if (!child.pid) {
      child.kill();
      resolve();
      return;
    }

    if (process.platform !== 'win32') {
      child.kill('SIGTERM');
      resolve();
      return;
    }

    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.once('error', () => {
      child.kill();
      resolve();
    });
    killer.once('close', () => resolve());
  });
}

async function runCandidate(candidate, args, options) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(candidate.command, [...candidate.argsPrefix, ...args], {
      cwd: options.workspacePath,
      env: process.env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let closeResolved = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      void killProcessTree(child);
    }, options.timeoutMs);

    child.stdout?.on('data', (chunk) => {
      stdout = appendCappedText(stdout, chunk.toString());
    });
    child.stderr?.on('data', (chunk) => {
      stderr = appendCappedText(stderr, chunk.toString());
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      if (closeResolved) {
        return;
      }

      closeResolved = true;
      resolve({
        candidate,
        startedAt,
        completedAt: Date.now(),
        spawnError: {
          message: error.message,
          code: error.code,
        },
        stdout,
        stderr,
      });
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timeout);
      if (closeResolved) {
        return;
      }

      closeResolved = true;
      resolve({
        candidate,
        startedAt,
        completedAt: Date.now(),
        exitCode,
        signal,
        timedOut,
        stdout,
        stderr,
      });
    });

    try {
      child.stdin?.write(options.prompt);
      child.stdin?.end();
    } catch {
      // Spawn/error handlers above will report the process state.
    }
  });
}

function shouldTryNextCandidate(result) {
  const code = result.spawnError?.code;
  return code === 'EPERM' || code === 'EACCES' || code === 'EINVAL' || code === 'ENOENT';
}

function buildResultFromProcessResult(processResult) {
  const parsedStdout = parseNdjsonLines(processResult.stdout ?? '');
  const analysis = analyzeApprovalProtocolEvents(parsedStdout.events);
  const cliFailedBeforeEvents =
    !processResult.timedOut
    && typeof processResult.exitCode === 'number'
    && processResult.exitCode !== 0
    && parsedStdout.events.length === 0;
  const spawnError = processResult.spawnError;
  const status = spawnError || cliFailedBeforeEvents ? 'unknown' : analysis.status;
  const message = createProbeMessage(status, processResult, analysis, parsedStdout);

  return {
    status,
    message,
    checkedAt: new Date().toISOString(),
    cliDisplayCommand: processResult.candidate?.displayCommand,
    observedEventTypes: analysis.observedEventTypes,
    hasStructuredApprovalRequest: analysis.hasStructuredApprovalRequest,
    hasCorrelationId: analysis.hasCorrelationId,
    hasProgrammaticReplyChannel: analysis.hasProgrammaticReplyChannel,
    approveDeterministic: analysis.approveDeterministic,
    rejectDeterministic: analysis.rejectDeterministic,
    rawEventPreview: analysis.rawEventPreview,
    probe: {
      exitCode: processResult.exitCode ?? null,
      signal: processResult.signal ?? null,
      timedOut: Boolean(processResult.timedOut),
      durationMs: processResult.completedAt - processResult.startedAt,
      stdoutLineCount: parsedStdout.lineCount,
      invalidStdoutLinePreview: parsedStdout.invalidLines,
      stderrPreview: (processResult.stderr ?? '').slice(0, 4 * 1024),
      spawnError: spawnError ?? null,
    },
  };
}

function createProbeMessage(status, processResult, analysis, parsedStdout) {
  if (processResult.spawnError) {
    return `Codex CLI could not be started: ${processResult.spawnError.message}`;
  }

  if (
    !processResult.timedOut
    && typeof processResult.exitCode === 'number'
    && processResult.exitCode !== 0
    && parsedStdout.events.length === 0
  ) {
    return `Codex CLI exited with code ${processResult.exitCode} before emitting JSON events.`;
  }

  if (status === 'supported') {
    return 'Codex approval protocol appears supported by the observed JSON events and deterministic approve/reject checks.';
  }

  if (!analysis.hasStructuredApprovalRequest) {
    return 'No structured approval request event was observed in codex exec --json output.';
  }

  if (!analysis.hasCorrelationId) {
    return 'A structured approval-like event was observed, but no request id or correlation key was found.';
  }

  if (!analysis.hasProgrammaticReplyChannel) {
    return 'A structured approval-like event was observed, but no programmatic reply channel was verified.';
  }

  return 'Structured approval metadata was observed, but approve and reject were not verified as deterministic.';
}

export async function runCodexApprovalProtocolProbe(options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const tempWorkspace = await mkdtemp(join(tmpdir(), 'fluxion-codex-approval-probe-'));
  const outputLastMessagePath = join(tempWorkspace, 'last-message.md');
  const prompt = [
    'This is a Fluxion compatibility probe.',
    'Create a file named fluxion-approval-probe.txt in the current workspace.',
    'The file must contain exactly: approval-probe',
    'Do not ask for clarification.',
  ].join('\n');

  try {
    const candidates = await resolveCodexCandidates();
    if (candidates.length === 0) {
      return {
        status: 'unknown',
        message: 'Codex CLI could not be resolved from PATH.',
        checkedAt: new Date().toISOString(),
        observedEventTypes: [],
        hasStructuredApprovalRequest: false,
        hasCorrelationId: false,
        hasProgrammaticReplyChannel: false,
        approveDeterministic: false,
        rejectDeterministic: false,
        rawEventPreview: [],
        probe: {
          exitCode: null,
          signal: null,
          timedOut: false,
          durationMs: 0,
          stdoutLineCount: 0,
          invalidStdoutLinePreview: [],
          stderrPreview: '',
          spawnError: null,
        },
      };
    }

    const args = buildCodexExecArgs(tempWorkspace, outputLastMessagePath);
    let lastResult;

    for (const candidate of candidates) {
      const result = await runCandidate(candidate, args, {
        workspacePath: tempWorkspace,
        timeoutMs,
        prompt,
      });
      lastResult = result;

      if (!shouldTryNextCandidate(result)) {
        break;
      }
    }

    return buildResultFromProcessResult(lastResult);
  } finally {
    if (!options.keepTemp) {
      await rm(tempWorkspace, { recursive: true, force: true });
    }
  }
}

function parseCliArgs(argv) {
  const parsed = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    keepTemp: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--keep-temp') {
      parsed.keepTemp = true;
      continue;
    }

    if (arg === '--timeout-ms') {
      const nextValue = Number(argv[index + 1]);
      if (Number.isFinite(nextValue) && nextValue > 0) {
        parsed.timeoutMs = Math.floor(nextValue);
      }
      index += 1;
    }
  }

  return parsed;
}

async function main() {
  const result = await runCodexApprovalProtocolProbe(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === 'supported' ? 0 : 1;
}

const entryPath = process.argv[1] ? pathToFileURL(fileURLToPath(import.meta.url)).href : '';
if (entryPath && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stdout.write(
      `${JSON.stringify(
        {
          status: 'unknown',
          message,
          checkedAt: new Date().toISOString(),
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  });
}
