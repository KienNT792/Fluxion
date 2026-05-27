import { access } from 'fs/promises'
import path from 'path'
import childProcess from 'child_process'

export interface ShellPathAdapter {
  openPath: (targetPath: string) => Promise<string>
  showItemInFolder: (targetPath: string) => void
}

export interface WindowsTerminalLaunchOptions {
  cwd: string
  title?: string
  commandline?: string
  panes?: Array<{
    title?: string
    commandline?: string
  }>
}

export async function validateShellTargetPath(pathValue: string): Promise<string> {
  if (typeof pathValue !== 'string' || !pathValue.trim()) {
    throw new Error('Path is required.')
  }

  const targetPath = pathValue.trim()
  if (!path.isAbsolute(targetPath)) {
    throw new Error(`Path must be absolute: ${targetPath}`)
  }

  try {
    await access(targetPath)
  } catch {
    throw new Error(`Path does not exist: ${targetPath}`)
  }

  return targetPath
}

export async function openShellPath(
  shellAdapter: ShellPathAdapter,
  pathValue: string
): Promise<void> {
  const targetPath = await validateShellTargetPath(pathValue)
  const shellError = await shellAdapter.openPath(targetPath)

  if (shellError) {
    throw new Error(shellError)
  }
}

export async function revealShellPath(
  shellAdapter: ShellPathAdapter,
  pathValue: string
): Promise<void> {
  const targetPath = await validateShellTargetPath(pathValue)
  shellAdapter.showItemInFolder(targetPath)
}

export async function openInWindowsTerminal(
  options: WindowsTerminalLaunchOptions
): Promise<void> {
  const cwd = await validateShellTargetPath(options.cwd)
  const title = typeof options.title === 'string' ? options.title.trim() : ''
  const commandline =
    typeof options.commandline === 'string' && options.commandline.trim().length > 0
      ? options.commandline.trim()
      : null
  const panes =
    options.panes?.filter(
      (pane) =>
        (typeof pane.commandline === 'string' && pane.commandline.trim().length > 0) ||
        (typeof pane.title === 'string' && pane.title.trim().length > 0)
    ) ?? []

  const args = ['-d', cwd]

  if (panes.length > 0) {
    const appendPaneArgs = (pane: { title?: string; commandline?: string }, firstPane: boolean) => {
      if (!firstPane) {
        args.push(';', 'split-pane', '-d', cwd)
      }

      const paneTitle = typeof pane.title === 'string' ? pane.title.trim() : ''
      const paneCommandline =
        typeof pane.commandline === 'string' && pane.commandline.trim().length > 0
          ? pane.commandline.trim()
          : null

      if (paneTitle) {
        args.push('--title', paneTitle)
      }

      if (paneCommandline) {
        args.push('powershell.exe', '-NoExit', '-Command', paneCommandline)
      }
    }

    panes.forEach((pane, index) => appendPaneArgs(pane, index === 0))
  } else {
    if (title) {
      args.push('--title', title)
    }

    if (commandline) {
      args.push('powershell.exe', '-NoExit', '-Command', commandline)
    }
  }

  await new Promise<void>((resolvePromise, reject) => {
    const child = childProcess.spawn('wt.exe', args, {
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    })

    child.once('error', (error) => {
      reject(new Error(`Failed to launch Windows Terminal: ${error.message}`))
    })

    child.once('spawn', () => {
      child.unref()
      resolvePromise()
    })
  })
}
