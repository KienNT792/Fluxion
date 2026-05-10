import { describe, expect, it } from 'vitest'
import { splitDisplayPath } from './file-path-card.helpers'

describe('splitDisplayPath', () => {
  it('splits Windows paths into basename and parent path', () => {
    expect(splitDisplayPath('C:\\Users\\Asus\\project\\output.md')).toEqual({
      basename: 'output.md',
      parentPath: 'C:\\Users\\Asus\\project',
      fullPath: 'C:\\Users\\Asus\\project\\output.md'
    })
  })

  it('splits relative POSIX-style paths for display', () => {
    expect(splitDisplayPath('.fluxion/memory/short-term/node-a.md')).toEqual({
      basename: 'node-a.md',
      parentPath: '.fluxion/memory/short-term',
      fullPath: '.fluxion/memory/short-term/node-a.md'
    })
  })

  it('returns a disabled display model for empty paths', () => {
    expect(splitDisplayPath('')).toEqual({
      basename: 'No file',
      parentPath: 'No path available',
      fullPath: ''
    })
  })
})
