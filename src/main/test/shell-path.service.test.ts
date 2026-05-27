import { mkdtemp, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  openInWindowsTerminal,
  openShellPath,
  revealShellPath,
  validateShellTargetPath
} from '../services/shell-path.service'
import childProcess from 'child_process'

let tempDir: string | undefined

async function createTempFile(): Promise<string> {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'fluxion-shell-path-'))
  const filePath = path.join(tempDir, 'output.md')
  await writeFile(filePath, '# output', 'utf8')
  return filePath
}

afterEach(async () => {
  if (tempDir) {
    const target = tempDir
    tempDir = undefined
    await rm(target, { recursive: true, force: true })
  }
})

describe('shell-path.service', () => {
  it('validates an existing absolute path', async () => {
    const filePath = await createTempFile()
    await expect(validateShellTargetPath(filePath)).resolves.toBe(filePath)
  })

  it('rejects empty, relative, and missing paths', async () => {
    await expect(validateShellTargetPath('')).rejects.toThrow('Path is required')
    await expect(validateShellTargetPath('relative\\file.md')).rejects.toThrow(
      'Path must be absolute'
    )
    const missingPath = path.join(os.tmpdir(), `missing-fluxion-file-${Date.now()}.md`)
    await expect(validateShellTargetPath(missingPath)).rejects.toThrow('Path does not exist')
  })

  it('opens a valid path through the shell adapter', async () => {
    const filePath = await createTempFile()
    const shellAdapter = {
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn()
    }

    await openShellPath(shellAdapter, filePath)

    expect(shellAdapter.openPath).toHaveBeenCalledWith(filePath)
    expect(shellAdapter.showItemInFolder).not.toHaveBeenCalled()
  })

  it('reveals a valid path through the shell adapter', async () => {
    const filePath = await createTempFile()
    const shellAdapter = {
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn()
    }

    await revealShellPath(shellAdapter, filePath)

    expect(shellAdapter.showItemInFolder).toHaveBeenCalledWith(filePath)
    expect(shellAdapter.openPath).not.toHaveBeenCalled()
  })

  it('returns shell open errors clearly', async () => {
    const filePath = await createTempFile()
    const shellAdapter = {
      openPath: vi.fn(async () => 'No app can open this file.'),
      showItemInFolder: vi.fn()
    }

    await expect(openShellPath(shellAdapter, filePath)).rejects.toThrow(
      'No app can open this file.'
    )
  })

  it('launches Windows Terminal with the expected arguments', async () => {
    const filePath = await createTempFile()
    const cwd = path.dirname(filePath)
    const spawnMock = vi
      .spyOn(childProcess, 'spawn')
      .mockImplementation((() => {
        const handlers = new Map<string, (...args: unknown[]) => void>()
        return {
          once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            handlers.set(event, handler)
            if (event === 'spawn') {
              queueMicrotask(() => handler())
            }
            return undefined
          }),
          unref: vi.fn()
        } as unknown as ReturnType<typeof childProcess.spawn>
      }) as typeof childProcess.spawn)

    await openInWindowsTerminal({
      cwd,
      title: 'Fluxion Runtime',
      commandline: "Write-Host 'ready'"
    })

    expect(spawnMock).toHaveBeenCalledWith(
      'wt.exe',
      [
        '-d',
        cwd,
        '--title',
        'Fluxion Runtime',
        'powershell.exe',
        '-NoExit',
        '-Command',
        "Write-Host 'ready'"
      ],
      expect.objectContaining({
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
    )

    spawnMock.mockRestore()
  })

  it('launches Windows Terminal split panes for multi-session debug payloads', async () => {
    const filePath = await createTempFile()
    const cwd = path.dirname(filePath)
    const spawnMock = vi
      .spyOn(childProcess, 'spawn')
      .mockImplementation((() => {
        const handlers = new Map<string, (...args: unknown[]) => void>()
        return {
          once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            handlers.set(event, handler)
            if (event === 'spawn') {
              queueMicrotask(() => handler())
            }
            return undefined
          }),
          unref: vi.fn()
        } as unknown as ReturnType<typeof childProcess.spawn>
      }) as typeof childProcess.spawn)

    await openInWindowsTerminal({
      cwd,
      panes: [
        { title: 'Repro', commandline: "Write-Host 'pane-a'" },
        { title: 'Trace', commandline: "Write-Host 'pane-b'" }
      ]
    })

    expect(spawnMock).toHaveBeenCalledWith(
      'wt.exe',
      [
        '-d',
        cwd,
        '--title',
        'Repro',
        'powershell.exe',
        '-NoExit',
        '-Command',
        "Write-Host 'pane-a'",
        ';',
        'split-pane',
        '-d',
        cwd,
        '--title',
        'Trace',
        'powershell.exe',
        '-NoExit',
        '-Command',
        "Write-Host 'pane-b'"
      ],
      expect.objectContaining({
        cwd,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
    )

    spawnMock.mockRestore()
  })
})
