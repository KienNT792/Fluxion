import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { scanWorkspaceContext } from '../services/context-scout.service';
import { createWorkspaceSnapshot } from '../services/context/workspace-snapshot';

async function writeWorkspaceFile(
  workspacePath: string,
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = join(workspacePath, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf8');
}

describe('context-scout.service', () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(
      workspaces.map((workspacePath) => rm(workspacePath, { recursive: true, force: true }))
    );
  });

  async function createWorkspace(prefix: string): Promise<string> {
    const workspacePath = await mkdtemp(join(tmpdir(), prefix));
    workspaces.push(workspacePath);
    return workspacePath;
  }

  it('classifies an empty workspace as blank', async () => {
    const workspacePath = await createWorkspace('fluxion-context-blank-');

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.workspaceType).toBe('blank');
    expect(result.projectName).toBeTruthy();
    expect(result.scannedFiles).toEqual([]);
    expect(result.detectedFields.recommendedFirstActions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Complete kickoff intent'),
      ])
    );
  });

  it('ignores generated directories while building the workspace snapshot', async () => {
    const workspacePath = await createWorkspace('fluxion-context-snapshot-');
    await writeWorkspaceFile(workspacePath, 'node_modules/pkg/package.json', '{}');
    await writeWorkspaceFile(workspacePath, 'target/classes/App.class', 'compiled');
    await writeWorkspaceFile(workspacePath, 'src/index.ts', 'export {};');

    const snapshot = await createWorkspaceSnapshot(workspacePath);

    expect(snapshot.hasFile('src/index.ts')).toBe(true);
    expect(snapshot.hasFile('node_modules/pkg/package.json')).toBe(false);
    expect(snapshot.hasFile('target/classes/App.class')).toBe(false);
  });

  it('classifies a repository with package metadata as existing', async () => {
    const workspacePath = await createWorkspace('fluxion-context-existing-');
    await mkdir(join(workspacePath, 'src', 'main'), { recursive: true });
    await writeWorkspaceFile(
      workspacePath,
      'package.json',
      JSON.stringify({
        name: 'fluxion',
        description: 'Windows-first workflow app',
        scripts: {
          typecheck: 'tsc --noEmit',
          test: 'vitest run',
        },
        dependencies: {
          electron: '^39.0.0',
          react: '^19.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
          vite: '^7.0.0',
        },
      })
    );
    await writeWorkspaceFile(workspacePath, 'README.md', '# Fluxion\n\nDesktop workflow orchestration.\n');

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.workspaceType).toBe('existing');
    expect(result.detectedFields.projectGoal).toBe('Windows-first workflow app');
    expect(result.detectedFields.primaryStack).toEqual(
      expect.arrayContaining(['Electron', 'React', 'Vite', 'TypeScript'])
    );
    expect(result.detectedFields.packageManagers).toEqual(expect.arrayContaining(['npm']));
    expect(result.detectedFields.verificationCommands).toEqual(
      expect.arrayContaining(['npm run typecheck', 'npm run test'])
    );
    expect(result.detectedFields.importantPaths).toEqual(
      expect.arrayContaining(['package.json', 'src'])
    );
  });

  it('detects Spring Boot Maven projects and Java bootstrap risks', async () => {
    const workspacePath = await createWorkspace('fluxion-context-java-');
    await writeWorkspaceFile(
      workspacePath,
      'pom.xml',
      `<?xml version="1.0"?>
<project>
  <artifactId>hospital-management</artifactId>
  <dependencies>
    <dependency><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><artifactId>mybatis-spring-boot-starter</artifactId></dependency>
    <dependency><artifactId>postgresql</artifactId></dependency>
    <dependency><artifactId>spring-boot-starter-data-redis</artifactId></dependency>
    <dependency><artifactId>spring-boot-starter-test</artifactId></dependency>
  </dependencies>
</project>`
    );
    await writeWorkspaceFile(workspacePath, 'mvnw.cmd', '@REM wrapper');
    await writeWorkspaceFile(
      workspacePath,
      'src/main/java/com/hms/HospitalManagementApplication.java',
      'class HospitalManagementApplication {}'
    );
    await writeWorkspaceFile(
      workspacePath,
      'src/main/java/com/hms/hospital_management/HospitalManagementApplication.java',
      'class HospitalManagementApplication {}'
    );
    await mkdir(join(workspacePath, 'src', 'main', 'java', 'com', 'hms', 'controller'), {
      recursive: true,
    });

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.workspaceType).toBe('existing');
    expect(result.projectName).toBe('hospital-management');
    expect(result.detectedFields.primaryStack).toEqual(
      expect.arrayContaining(['Java', 'Spring Boot', 'MyBatis', 'PostgreSQL', 'Redis'])
    );
    expect(result.detectedFields.verificationCommands).toEqual(
      expect.arrayContaining(['.\\mvnw.cmd test'])
    );
    expect(result.detectedFields.entrypoints).toHaveLength(2);
    expect(result.detectedFields.riskFlags).toEqual(
      expect.arrayContaining([expect.stringContaining('Multiple Java application entrypoints')])
    );
  });

  it.each([
    {
      name: 'Gradle',
      files: {
        'settings.gradle': "rootProject.name = 'demo'",
        'build.gradle': "plugins { id 'org.springframework.boot' version '3.2.5' }",
      },
      stack: ['Java', 'Spring Boot'],
      command: 'gradle test',
    },
    {
      name: 'FastAPI',
      files: {
        'pyproject.toml': '[project]\nname = "api"\ndependencies = ["fastapi", "pytest"]',
        'src/main.py': 'from fastapi import FastAPI',
      },
      stack: ['Python', 'FastAPI'],
      command: 'python -m pytest',
    },
    {
      name: 'Go',
      files: {
        'go.mod': 'module example.com/demo',
        'cmd/api/main.go': 'package main',
      },
      stack: ['Go'],
      command: 'go test ./...',
    },
    {
      name: 'Rust',
      files: {
        'Cargo.toml': '[package]\nname = "demo"',
        'src/main.rs': 'fn main() {}',
      },
      stack: ['Rust'],
      command: 'cargo test',
    },
    {
      name: '.NET',
      files: {
        'Demo.sln': '',
        'Demo/Demo.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>',
      },
      stack: ['.NET', 'ASP.NET Core'],
      command: 'dotnet test',
    },
    {
      name: 'PHP',
      files: {
        'composer.json': JSON.stringify({
          require: { 'laravel/framework': '^11.0' },
          'require-dev': { 'phpunit/phpunit': '^11.0' },
        }),
      },
      stack: ['PHP', 'Laravel'],
      command: 'vendor\\bin\\phpunit',
    },
    {
      name: 'Ruby',
      files: {
        Gemfile: "gem 'rails'\ngem 'rspec'",
      },
      stack: ['Ruby', 'Rails'],
      command: 'bundle exec rspec',
    },
    {
      name: 'Flutter',
      files: {
        'pubspec.yaml': 'name: demo',
        'lib/main.dart': 'void main() {}',
      },
      stack: ['Flutter'],
      command: 'flutter test',
    },
    {
      name: 'Terraform',
      files: {
        'main.tf': 'terraform {}',
      },
      stack: ['Terraform'],
      command: 'terraform validate',
    },
  ])('detects $name projects', async ({ files, stack, command }) => {
    const workspacePath = await createWorkspace('fluxion-context-fixture-');
    for (const [relativePath, content] of Object.entries(files)) {
      await writeWorkspaceFile(workspacePath, relativePath, content);
    }

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.workspaceType).toBe('existing');
    expect(result.detectedFields.primaryStack).toEqual(expect.arrayContaining(stack));
    expect(result.detectedFields.verificationCommands).toEqual(expect.arrayContaining([command]));
  });

  it('detects monorepo signals', async () => {
    const workspacePath = await createWorkspace('fluxion-context-monorepo-');
    await writeWorkspaceFile(workspacePath, 'pnpm-workspace.yaml', 'packages:\n  - apps/*');
    await writeWorkspaceFile(workspacePath, 'apps/web/package.json', JSON.stringify({ name: 'web' }));

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.detectedFields.primaryStack).toEqual(expect.arrayContaining(['Monorepo']));
    expect(result.detectedFields.riskFlags).toEqual(
      expect.arrayContaining([expect.stringContaining('Multiple project roots')])
    );
  });

  it('classifies a repository with AGENTS.md as existing_with_instructions', async () => {
    const workspacePath = await createWorkspace('fluxion-context-instructions-');
    await writeWorkspaceFile(workspacePath, 'AGENTS.md', '# Repo instructions');

    const result = await scanWorkspaceContext(workspacePath);

    expect(result.workspaceType).toBe('existing_with_instructions');
    expect(result.sourceEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'workspaceType',
          sourcePath: 'AGENTS.md',
          confidence: 'high',
        }),
      ])
    );
  });
});
