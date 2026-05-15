export interface ModelIconSignature {
  accentColor: string
  background: string
  label: string
  title: string
}

function compactVersion(version: string, suffix?: string): string {
  const parts = version.split('.').filter(Boolean)
  const base = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : version
  return suffix ? `${base}${suffix}` : base
}

export function getModelIconSignature(modelId: string, displayName = modelId): ModelIconSignature {
  const normalized = modelId.trim().toLowerCase()

  if (!normalized) {
    return {
      accentColor: 'var(--color-muted)',
      background: 'var(--color-canvas-soft)',
      label: 'AI',
      title: displayName || 'Model'
    }
  }

  const gptMatch = /^gpt-(\d+(?:\.\d+)?)(?:-(mini|codex|pro|spark|max))?/i.exec(normalized)
  if (gptMatch) {
    const suffixMap: Record<string, string> = {
      codex: 'C',
      max: 'M',
      mini: 'm',
      pro: 'P',
      spark: 'S'
    }
    const suffix = gptMatch[2] ? suffixMap[gptMatch[2]] : undefined

    return {
      accentColor: gptMatch[2] === 'codex' ? 'var(--color-primary)' : 'var(--color-timeline-read)',
      background:
        gptMatch[2] === 'codex'
          ? 'color-mix(in srgb, var(--color-primary) 10%, var(--color-canvas-soft))'
          : 'var(--color-canvas-soft)',
      label: compactVersion(gptMatch[1], suffix),
      title: displayName || modelId
    }
  }

  const codexMatch = /^codex-(\d+(?:\.\d+)?)/i.exec(normalized)
  if (codexMatch) {
    return {
      accentColor: 'var(--color-primary)',
      background: 'color-mix(in srgb, var(--color-primary) 10%, var(--color-canvas-soft))',
      label: `C${codexMatch[1]}`,
      title: displayName || modelId
    }
  }

  const oSeriesMatch = /^o(\d+(?:\.\d+)?)(?:-(mini|pro))?/i.exec(normalized)
  if (oSeriesMatch) {
    return {
      accentColor: 'var(--color-timeline-edit)',
      background: 'var(--color-canvas-soft)',
      label: `o${oSeriesMatch[1]}${oSeriesMatch[2] === 'mini' ? 'm' : ''}`,
      title: displayName || modelId
    }
  }

  return {
    accentColor: 'var(--color-muted)',
    background: 'var(--color-canvas-soft)',
    label: normalized.slice(0, 3).toUpperCase(),
    title: displayName || modelId
  }
}
