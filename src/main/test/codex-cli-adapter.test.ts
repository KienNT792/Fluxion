import { describe, expect, it } from 'vitest';
import { RunnerEvent } from '@core';
import { AgentChunk } from '@shared';
import {
  extractJsonEventSummary,
  translateRunnerEventToChunk,
} from '../adapters/codex-cli.adapter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = 1_000_000;
const now = (): number => NOW;

function stdout(content: string): RunnerEvent {
  return { type: 'stdout', content, timestamp: NOW };
}

function stderr(content: string): RunnerEvent {
  return { type: 'stderr', content, timestamp: NOW };
}

function status(content: string): RunnerEvent {
  return { type: 'status', content, timestamp: NOW };
}

function jsonEvent(event: unknown, raw = ''): RunnerEvent {
  return { type: 'json-event', event, raw, timestamp: NOW };
}

// ─── translateRunnerEventToChunk ──────────────────────────────────────────────

describe('translateRunnerEventToChunk', () => {
  describe('stdout passthrough', () => {
    it('returns stdout chunk unchanged', () => {
      const result = translateRunnerEventToChunk(stdout('hello\n'), now);
      expect(result).toEqual<AgentChunk>({
        type: 'stdout',
        content: 'hello\n',
        timestamp: NOW,
      });
    });

    it('preserves ANSI codes in stdout', () => {
      const content = '\x1b[32mgreen\x1b[0m\n';
      const result = translateRunnerEventToChunk(stdout(content), now);
      expect(result?.content).toBe(content);
    });
  });

  describe('stderr passthrough', () => {
    it('returns stderr chunk unchanged', () => {
      const result = translateRunnerEventToChunk(stderr('oops\n'), now);
      expect(result).toEqual<AgentChunk>({
        type: 'stderr',
        content: 'oops\n',
        timestamp: NOW,
      });
    });
  });

  describe('status events', () => {
    it('wraps status content with dim [codex] prefix as stdout', () => {
      const result = translateRunnerEventToChunk(status('Starting Codex CLI via npx.'), now);
      expect(result?.type).toBe('stdout');
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m Starting Codex CLI via npx.\n');
    });

    it('suppresses empty status events', () => {
      const result = translateRunnerEventToChunk(status('   '), now);
      expect(result).toBeNull();
    });

    it('trims trailing whitespace from status content', () => {
      const result = translateRunnerEventToChunk(status('loading   '), now);
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m loading\n');
    });
  });

  describe('json-event translation', () => {
    it('returns null for unknown event type (no raw JSON emitted)', () => {
      const result = translateRunnerEventToChunk(jsonEvent({ type: 'internal_metric', value: 42 }));
      expect(result).toBeNull();
    });

    it('returns null for null event payload', () => {
      expect(translateRunnerEventToChunk(jsonEvent(null))).toBeNull();
    });

    it('returns null for non-object payload', () => {
      expect(translateRunnerEventToChunk(jsonEvent('raw string'))).toBeNull();
    });

    it('does not emit raw JSON for unknown json-event', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'mystery', payload: { secret: 'data' } })
      );
      expect(result).toBeNull();
    });

    it('translates session_started', () => {
      const result = translateRunnerEventToChunk(jsonEvent({ type: 'session_started' }), now);
      expect(result?.type).toBe('stdout');
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m session started\n');
    });

    it('translates session_stopped', () => {
      const result = translateRunnerEventToChunk(jsonEvent({ type: 'session_stopped' }), now);
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m session completed\n');
    });

    it('translates session_completed', () => {
      const result = translateRunnerEventToChunk(jsonEvent({ type: 'session_completed' }), now);
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m session completed\n');
    });

    it('suppresses text_delta events (high-frequency token stream)', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'message', msg: { type: 'text_delta', delta: 'Hello' } })
      );
      expect(result).toBeNull();
    });

    it('translates assistant_message', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'message', msg: { type: 'assistant_message' } }),
        now
      );
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m assistant response received\n');
    });

    it('translates function_call with name', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'function_call', name: 'bash' }),
        now
      );
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m running: bash\n');
    });

    it('translates function_call without name', () => {
      const result = translateRunnerEventToChunk(jsonEvent({ type: 'function_call' }), now);
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m running command\n');
    });

    it('translates tool_call with command', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'tool_call', command: 'npm install' }),
        now
      );
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m running: npm install\n');
    });

    it('translates function_call_output', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'function_call_output' }),
        now
      );
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m command completed\n');
    });

    it('translates file_read with path', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'file_read', path: 'src/index.ts' }),
        now
      );
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m reading: src/index.ts\n');
    });

    it('translates file_write with path', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'file_write', path: 'src/output.ts' }),
        now
      );
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m editing: src/output.ts\n');
    });

    it('routes string error field to stderr with red [error] prefix', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'error', error: 'rate limit exceeded' }),
        now
      );
      expect(result?.type).toBe('stderr');
      expect(result?.content).toBe('\x1b[31m[error]\x1b[0m rate limit exceeded\n');
    });

    it('routes object error field to stderr with red [error] prefix', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ error: { message: 'timeout' } }),
        now
      );
      expect(result?.type).toBe('stderr');
      expect(result?.content).toBe('\x1b[31m[error]\x1b[0m timeout\n');
    });

    it('routes non-error json-event to stdout (not stderr)', () => {
      const result = translateRunnerEventToChunk(
        jsonEvent({ type: 'session_started' }),
        now
      );
      expect(result?.type).toBe('stdout');
      expect(result?.content).toBe('\x1b[2m[codex]\x1b[0m session started\n');
    });
  });
});

// ─── extractJsonEventSummary (unit, no timestamp) ────────────────────────────

describe('extractJsonEventSummary', () => {
  it('returns null for null', () => {
    expect(extractJsonEventSummary(null)).toBeNull();
  });

  it('returns null for primitive values', () => {
    expect(extractJsonEventSummary(42)).toBeNull();
    expect(extractJsonEventSummary('string')).toBeNull();
    expect(extractJsonEventSummary(true)).toBeNull();
  });

  it('returns null for an empty object', () => {
    expect(extractJsonEventSummary({})).toBeNull();
  });

  it('never returns a raw JSON string', () => {
    const result = extractJsonEventSummary({ type: 'unknown_type', data: { huge: 'payload' } });
    expect(result).toBeNull();
  });
});
