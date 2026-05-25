import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { discoverWorkspaceSkillLibrary, formatWorkspaceSkillLibrary } from './onboarding-skill-library'

describe('onboarding skill library', () => {
  let workspacePath: string

  beforeEach(async () => {
    workspacePath = await mkdtemp(join(tmpdir(), 'fluxion-skill-library-'))
  })

  afterEach(async () => {
    await rm(workspacePath, { recursive: true, force: true })
  })

  it('discovers repo-local skills and prompt assets from workspace-scoped folders', async () => {
    await mkdir(join(workspacePath, '.agents', 'skills', 'alpha'), { recursive: true })
    await writeFile(
      join(workspacePath, '.agents', 'skills', 'alpha', 'SKILL.md'),
      ['---', 'name: alpha', 'description: Alpha skill', '---', '', '# Alpha', 'Use Alpha'].join(
        '\n'
      ),
      'utf8'
    )
    await mkdir(join(workspacePath, '.github', 'codex', 'prompts'), { recursive: true })
    await writeFile(
      join(workspacePath, '.github', 'codex', 'prompts', 'triage.prompt.md'),
      ['---', 'name: triage', 'description: Triage prompt', '---', '', 'Triage the issue.'].join(
        '\n'
      ),
      'utf8'
    )

    const library = await discoverWorkspaceSkillLibrary(workspacePath)

    expect(library.assets.map((asset) => asset.id)).toEqual(['alpha', 'triage'])
    expect(formatWorkspaceSkillLibrary(library)).toContain('alpha')
    expect(formatWorkspaceSkillLibrary(library)).toContain('triage')
  })
})
