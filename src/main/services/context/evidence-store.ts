import { ContextSourceEvidence } from '@shared';
import { ulid } from 'ulid';

export class EvidenceStore {
  private readonly evidenceByFingerprint = new Map<string, ContextSourceEvidence>();

  public add(evidence: ContextSourceEvidence): ContextSourceEvidence {
    const fingerprint = this.fingerprint(evidence);
    const existing = this.evidenceByFingerprint.get(fingerprint);

    if (existing) {
      return existing;
    }

    const stored = {
      ...evidence,
      id: evidence.id?.trim() || ulid(),
    };
    this.evidenceByFingerprint.set(fingerprint, stored);
    return stored;
  }

  public addAll(evidence: ContextSourceEvidence[]): ContextSourceEvidence[] {
    return evidence.map((item) => this.add(item));
  }

  private fingerprint(evidence: ContextSourceEvidence): string {
    return [
      evidence.field,
      evidence.detectorId ?? '',
      evidence.sourcePath,
      evidence.rawValue ?? '',
      evidence.matchedSignals?.join('|') ?? '',
      evidence.note ?? '',
    ].join('::');
  }
}

export function normalizeContextEvidence(
  evidence: ContextSourceEvidence[]
): ContextSourceEvidence[] {
  return new EvidenceStore().addAll(evidence);
}
