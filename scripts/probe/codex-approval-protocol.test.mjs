import { describe, expect, it } from 'vitest';
import {
  analyzeApprovalProtocolEvents,
  isStructuredApprovalRequest,
  parseNdjsonLines,
} from './codex-approval-protocol.mjs';

describe('codex approval protocol probe helpers', () => {
  it('parses NDJSON events and keeps invalid line previews', () => {
    const result = parseNdjsonLines('{"type":"session.started"}\nnot-json\n{"type":"done"}\n');

    expect(result.events).toEqual([
      { type: 'session.started' },
      { type: 'done' },
    ]);
    expect(result.invalidLines).toEqual(['not-json']);
    expect(result.lineCount).toBe(3);
  });

  it('detects approval-like structured JSON events without terminal prompt text', () => {
    expect(
      isStructuredApprovalRequest({
        type: 'approval_request',
        request_id: 'approval-1',
      })
    ).toBe(true);
    expect(
      isStructuredApprovalRequest({
        type: 'agent_message',
        message: 'Approve? y/n',
      })
    ).toBe(false);
  });

  it('does not mark protocol supported until reply channel and deterministic decisions are verified', () => {
    const result = analyzeApprovalProtocolEvents([
      {
        type: 'approval_request',
        request_id: 'approval-1',
      },
    ]);

    expect(result).toMatchObject({
      status: 'unsupported',
      hasStructuredApprovalRequest: true,
      hasCorrelationId: true,
      hasProgrammaticReplyChannel: false,
      approveDeterministic: false,
      rejectDeterministic: false,
    });
  });

  it('marks supported only when all protocol checks pass', () => {
    const result = analyzeApprovalProtocolEvents(
      [
        {
          type: 'approval_request',
          request_id: 'approval-1',
          reply_channel: { type: 'json-rpc' },
        },
      ],
      {
        approveDeterministic: true,
        rejectDeterministic: true,
      }
    );

    expect(result).toMatchObject({
      status: 'supported',
      hasStructuredApprovalRequest: true,
      hasCorrelationId: true,
      hasProgrammaticReplyChannel: true,
      approveDeterministic: true,
      rejectDeterministic: true,
    });
  });
});
