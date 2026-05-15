import { describe, expect, it } from 'vitest'
import { ArtifactRefSchema } from '../schema/artifact.schema'

describe('ArtifactRefSchema', () => {
  it('accepts a workspace-relative artifact path', () => {
    const parsed = ArtifactRefSchema.parse({ path: 'docs/output.md' })
    expect(parsed.path).toBe('docs/output.md')
  })

  it('normalizes Windows separators to forward slashes', () => {
    const parsed = ArtifactRefSchema.parse({ path: 'docs\\nested\\output.md' })
    expect(parsed.path).toBe('docs/nested/output.md')
  })

  it('rejects an absolute Windows path', () => {
    expect(() => ArtifactRefSchema.parse({ path: 'C:\\temp\\output.md' })).toThrow()
  })

  it('rejects parent directory traversal', () => {
    expect(() => ArtifactRefSchema.parse({ path: '../secret.md' })).toThrow()
  })
})
