import { ContextSourceEvidence, ProjectContextField } from '@shared';
import { WorkspaceSnapshot, WorkspaceSnapshotFile } from './workspace-snapshot';

export interface ProjectDetectionResult {
  detectorId: string;
  projectName?: string;
  projectGoal?: string;
  targetUsers?: string;
  primaryStack: string[];
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  buildSystems: string[];
  testFrameworks: string[];
  verificationCommands: string[];
  importantPaths: string[];
  architectureParts: string[];
  entrypoints: string[];
  moduleBoundaries: string[];
  generatedOrIgnoredPaths: string[];
  riskFlags: string[];
  recommendedFirstActions: string[];
  evidence: ContextSourceEvidence[];
}

export interface ProjectDetector {
  id: string;
  detect(snapshot: WorkspaceSnapshot): Promise<ProjectDetectionResult | null>;
}

interface PackageJsonShape {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PyProjectShape {
  name?: string;
  description?: string;
  dependencies: string[];
}

function createResult(detectorId: string): ProjectDetectionResult {
  return {
    detectorId,
    primaryStack: [],
    languages: [],
    frameworks: [],
    packageManagers: [],
    buildSystems: [],
    testFrameworks: [],
    verificationCommands: [],
    importantPaths: [],
    architectureParts: [],
    entrypoints: [],
    moduleBoundaries: [],
    generatedOrIgnoredPaths: [],
    riskFlags: [],
    recommendedFirstActions: [],
    evidence: [],
  };
}

function addUnique(target: string[], values: Array<string | undefined>): void {
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed || target.includes(trimmed)) {
      continue;
    }
    target.push(trimmed);
  }
}

function addEvidence(
  result: ProjectDetectionResult,
  field: ProjectContextField,
  sourcePath: string,
  confidence: ContextSourceEvidence['confidence'],
  note: string,
  matchedSignals: string[] = [],
  rawValue?: string
): void {
  result.evidence.push({
    field,
    sourcePath,
    confidence,
    note,
    detectorId: result.detectorId,
    matchedSignals,
    rawValue,
    confidenceReason: note,
  });
}

function hasAnyFile(snapshot: WorkspaceSnapshot, paths: string[]): boolean {
  return paths.some((filePath) => snapshot.hasFile(filePath));
}

function hasAnyDirectory(snapshot: WorkspaceSnapshot, paths: string[]): boolean {
  return paths.some((directoryPath) => snapshot.hasDirectory(directoryPath));
}

function fileNameEquals(file: WorkspaceSnapshotFile, name: string): boolean {
  return file.name.toLowerCase() === name.toLowerCase();
}

function parseJsonObject<T extends object>(text: string | null): T | null {
  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function packageNames(pkg: PackageJsonShape): Set<string> {
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
}

function packageManagerCommand(snapshot: WorkspaceSnapshot): {
  manager: string;
  commandPrefix: string;
} {
  if (snapshot.hasFile('pnpm-lock.yaml')) {
    return { manager: 'pnpm', commandPrefix: 'pnpm' };
  }
  if (snapshot.hasFile('yarn.lock')) {
    return { manager: 'yarn', commandPrefix: 'yarn' };
  }
  if (snapshot.hasFile('bun.lockb') || snapshot.hasFile('bun.lock')) {
    return { manager: 'bun', commandPrefix: 'bun run' };
  }
  return { manager: 'npm', commandPrefix: 'npm run' };
}

function scriptCommand(commandPrefix: string, scriptName: string): string {
  if (commandPrefix === 'yarn') {
    return `yarn ${scriptName}`;
  }
  return `${commandPrefix} ${scriptName}`;
}

function xmlTagValue(xml: string, tagName: string): string | undefined {
  const match = xml.match(new RegExp(`<${tagName}>\\s*([^<]+?)\\s*</${tagName}>`, 'i'));
  return match?.[1]?.trim();
}

function parsePyProject(text: string | null): PyProjectShape {
  const result: PyProjectShape = {
    dependencies: [],
  };
  if (!text) {
    return result;
  }

  const nameMatch = text.match(/^\s*name\s*=\s*["']([^"']+)["']/m);
  const descriptionMatch = text.match(/^\s*description\s*=\s*["']([^"']+)["']/m);
  result.name = nameMatch?.[1]?.trim();
  result.description = descriptionMatch?.[1]?.trim();

  const dependencyMatches = [...text.matchAll(/["']([A-Za-z0-9_.-]+)(?:[<>=~! ].*)?["']/g)];
  result.dependencies = dependencyMatches.map((match) => match[1]?.toLowerCase() ?? '');

  return result;
}

function detectReadmeTargetUsers(readme: string | null): string | undefined {
  if (!readme) {
    return undefined;
  }

  const lines = readme.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => {
    const normalized = line.toLowerCase();
    return normalized.includes('target users')
      || normalized.includes('audience')
      || normalized.includes('aimed at');
  });
  if (startIndex < 0) {
    return undefined;
  }

  const values: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';
    if (!line) {
      break;
    }
    if (line.startsWith('#')) {
      break;
    }
    values.push(line.replace(/^-+\s*/, ''));
  }

  return values.join(' ').trim() || undefined;
}

function firstReadmeParagraph(readme: string | null): string | undefined {
  if (!readme) {
    return undefined;
  }

  return readme
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#'));
}

export const nodeDetector: ProjectDetector = {
  id: 'node',
  async detect(snapshot) {
    const packageJson = parseJsonObject<PackageJsonShape>(await snapshot.readText('package.json'));
    if (!packageJson) {
      return null;
    }

    const result = createResult(this.id);
    const packages = packageNames(packageJson);
    const scripts = packageJson.scripts ?? {};
    const { manager, commandPrefix } = packageManagerCommand(snapshot);

    result.projectName = packageJson.name?.trim();
    result.projectGoal = packageJson.description?.trim();
    addUnique(result.languages, ['JavaScript']);
    if (
      snapshot.hasFile('tsconfig.json')
      || packages.has('typescript')
      || snapshot.files.some((file) => file.extension === '.ts' || file.extension === '.tsx')
    ) {
      addUnique(result.languages, ['TypeScript']);
    }
    addUnique(result.packageManagers, [manager]);
    addUnique(result.buildSystems, ['Node scripts']);

    if (packages.has('electron') || packages.has('electron-vite')) {
      addUnique(result.frameworks, ['Electron']);
      addUnique(result.primaryStack, ['Electron']);
    }
    if (packages.has('react')) {
      addUnique(result.frameworks, ['React']);
      addUnique(result.primaryStack, ['React']);
    }
    if (packages.has('next')) {
      addUnique(result.frameworks, ['Next.js']);
      addUnique(result.primaryStack, ['Next.js']);
    }
    if (packages.has('vite') || packages.has('electron-vite')) {
      addUnique(result.frameworks, ['Vite']);
      addUnique(result.primaryStack, ['Vite']);
    }
    if (packages.has('@nestjs/core')) {
      addUnique(result.frameworks, ['NestJS']);
      addUnique(result.primaryStack, ['NestJS']);
    }
    if (packages.has('express')) {
      addUnique(result.frameworks, ['Express']);
      addUnique(result.primaryStack, ['Express']);
    }
    if (packages.has('tailwindcss') || packages.has('@tailwindcss/vite')) {
      addUnique(result.frameworks, ['Tailwind CSS']);
    }
    if (packages.has('vitest')) {
      addUnique(result.testFrameworks, ['Vitest']);
    }
    if (packages.has('jest')) {
      addUnique(result.testFrameworks, ['Jest']);
    }
    if (packages.has('@playwright/test')) {
      addUnique(result.testFrameworks, ['Playwright']);
    }

    addUnique(result.primaryStack, result.languages);
    addUnique(result.importantPaths, ['package.json', 'src', 'app', 'pages', 'packages', 'apps'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));
    addUnique(result.entrypoints, ['src/main/index.ts', 'src/main.ts', 'src/index.ts', 'src/App.tsx', 'app/page.tsx', 'pages/index.tsx'].filter((item) => snapshot.hasFile(item)));
    if (hasAnyDirectory(snapshot, ['src/main', 'src/preload', 'src/renderer'])) {
      addUnique(result.moduleBoundaries, ['Electron main/preload/renderer layers']);
      addUnique(result.importantPaths, ['src/main', 'src/preload', 'src/renderer'].filter((item) => snapshot.hasDirectory(item)));
      addUnique(result.architectureParts, ['Electron app split across main, preload, and renderer surfaces.']);
    } else if (hasAnyDirectory(snapshot, ['app', 'pages'])) {
      addUnique(result.moduleBoundaries, ['Next.js route/app surfaces']);
      addUnique(result.architectureParts, ['Web app organized around Next.js routing conventions.']);
    } else if (snapshot.hasDirectory('src')) {
      addUnique(result.architectureParts, ['Node project with source code under src/.']);
    }

    addUnique(
      result.verificationCommands,
      ['typecheck', 'test', 'lint', 'build']
        .filter((scriptName) => typeof scripts[scriptName] === 'string')
        .map((scriptName) => scriptCommand(commandPrefix, scriptName))
    );
    if (result.verificationCommands.length === 0) {
      addUnique(result.riskFlags, ['No package verification scripts were detected in package.json.']);
    }

    addEvidence(result, 'primaryStack', 'package.json', 'high', 'Derived from Node dependencies and scripts.', [...packages]);
    if (result.verificationCommands.length > 0) {
      addEvidence(result, 'verificationCommands', 'package.json', 'high', 'Derived from available package scripts.', Object.keys(scripts));
    }
    return result;
  },
};

export const javaDetector: ProjectDetector = {
  id: 'java',
  async detect(snapshot) {
    const hasMaven = snapshot.hasFile('pom.xml');
    const gradleFiles = snapshot.files.filter((file) => ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'].includes(file.name));
    if (!hasMaven && gradleFiles.length === 0) {
      return null;
    }

    const result = createResult(this.id);
    addUnique(result.languages, ['Java']);
    addUnique(result.primaryStack, ['Java']);
    addUnique(result.importantPaths, ['src/main/java', 'src/main/resources', 'src/test/java'].filter((item) => snapshot.hasDirectory(item)));

    if (hasMaven) {
      const pom = await snapshot.readText('pom.xml');
      result.projectName = xmlTagValue(pom ?? '', 'artifactId');
      addUnique(result.buildSystems, ['Maven']);
      addUnique(result.packageManagers, ['Maven']);
      addUnique(result.importantPaths, ['pom.xml']);
      addUnique(result.verificationCommands, [snapshot.hasFile('mvnw.cmd') ? '.\\mvnw.cmd test' : 'mvn test']);

      const signals = [
        pom?.includes('spring-boot-starter') ? 'spring-boot-starter' : undefined,
        pom?.includes('mybatis') ? 'mybatis' : undefined,
        pom?.includes('postgresql') ? 'postgresql' : undefined,
        pom?.includes('spring-boot-starter-data-redis') ? 'redis' : undefined,
        pom?.includes('junit') || pom?.includes('spring-boot-starter-test') ? 'test' : undefined,
      ].filter(Boolean) as string[];
      if (pom?.includes('spring-boot-starter')) {
        addUnique(result.frameworks, ['Spring Boot']);
        addUnique(result.primaryStack, ['Spring Boot']);
      }
      if (pom?.includes('mybatis')) {
        addUnique(result.frameworks, ['MyBatis']);
        addUnique(result.primaryStack, ['MyBatis']);
      }
      if (pom?.includes('postgresql')) {
        addUnique(result.primaryStack, ['PostgreSQL']);
      }
      if (pom?.includes('spring-boot-starter-data-redis')) {
        addUnique(result.primaryStack, ['Redis']);
      }
      if (pom?.includes('spring-boot-starter-test') || pom?.includes('junit')) {
        addUnique(result.testFrameworks, ['JUnit']);
      }
      addEvidence(result, 'primaryStack', 'pom.xml', 'high', 'Derived from Maven dependencies.', signals);
    }

    if (gradleFiles.length > 0) {
      const buildFile = gradleFiles.find((file) => file.name.startsWith('build.gradle')) ?? gradleFiles[0];
      const buildText = buildFile ? await snapshot.readText(buildFile.relativePath) : null;
      addUnique(result.buildSystems, ['Gradle']);
      addUnique(result.packageManagers, ['Gradle']);
      addUnique(result.importantPaths, gradleFiles.map((file) => file.relativePath));
      addUnique(result.verificationCommands, [snapshot.hasFile('gradlew.bat') ? '.\\gradlew.bat test' : 'gradle test']);
      if (buildText?.includes('org.springframework.boot')) {
        addUnique(result.frameworks, ['Spring Boot']);
        addUnique(result.primaryStack, ['Spring Boot']);
      }
      if (buildText?.includes('kotlin')) {
        addUnique(result.languages, ['Kotlin']);
        addUnique(result.primaryStack, ['Kotlin']);
      }
      addEvidence(result, 'primaryStack', buildFile?.relativePath ?? 'build.gradle', 'high', 'Derived from Gradle build files.');
    }

    if (snapshot.hasDirectory('src/main/java')) {
      const boundaries = ['controller', 'service', 'repository', 'mapper', 'domain', 'dto', 'config', 'security']
        .filter((name) => snapshot.directories.some((directory) => directory.relativePath.endsWith(`/src/main/java/${name}`) || directory.relativePath.endsWith(`/src/main/java/com/${name}`) || directory.name === name));
      if (boundaries.length > 0) {
        addUnique(result.moduleBoundaries, boundaries.map((name) => `Java ${name} layer`));
        addUnique(result.architectureParts, ['Layered Java backend with application, domain, service, persistence, and configuration code.']);
      } else {
        addUnique(result.architectureParts, ['Java backend source code under src/main/java.']);
      }
    }

    addUnique(result.entrypoints, snapshot.files
      .filter((file) => file.relativePath.startsWith('src/main/java/') && file.name.endsWith('Application.java'))
      .map((file) => file.relativePath));
    if (result.entrypoints.length > 1) {
      addUnique(result.riskFlags, ['Multiple Java application entrypoints were detected; bootstrap package may need review.']);
      addUnique(result.recommendedFirstActions, ['Review duplicate Java application entrypoints before feature work.']);
    }
    addEvidence(result, 'verificationCommands', hasMaven ? 'pom.xml' : gradleFiles[0]?.relativePath ?? 'build.gradle', 'high', 'Derived from Java build wrapper and build tool.');
    return result;
  },
};

export const pythonDetector: ProjectDetector = {
  id: 'python',
  async detect(snapshot) {
    const hasPythonSignals = hasAnyFile(snapshot, ['pyproject.toml', 'requirements.txt', 'Pipfile', 'poetry.lock', 'manage.py'])
      || snapshot.files.some((file) => file.extension === '.py');
    if (!hasPythonSignals) {
      return null;
    }

    const result = createResult(this.id);
    const pyProject = parsePyProject(await snapshot.readText('pyproject.toml'));
    const requirements = (await snapshot.readText('requirements.txt'))?.toLowerCase() ?? '';
    const combinedSignals = `${pyProject.dependencies.join('\n')}\n${requirements}`;

    result.projectName = pyProject.name;
    result.projectGoal = pyProject.description;
    addUnique(result.languages, ['Python']);
    addUnique(result.primaryStack, ['Python']);
    addUnique(result.importantPaths, ['pyproject.toml', 'requirements.txt', 'Pipfile', 'manage.py', 'src', 'tests'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));

    if (snapshot.hasFile('poetry.lock') || snapshot.hasFile('pyproject.toml')) {
      addUnique(result.packageManagers, [snapshot.hasFile('poetry.lock') ? 'Poetry' : 'Python packaging']);
      addUnique(result.buildSystems, ['pyproject']);
    }
    if (snapshot.hasFile('Pipfile')) {
      addUnique(result.packageManagers, ['Pipenv']);
    }
    if (snapshot.hasFile('requirements.txt')) {
      addUnique(result.packageManagers, ['pip']);
    }
    if (combinedSignals.includes('fastapi')) {
      addUnique(result.frameworks, ['FastAPI']);
      addUnique(result.primaryStack, ['FastAPI']);
    }
    if (combinedSignals.includes('django') || snapshot.hasFile('manage.py')) {
      addUnique(result.frameworks, ['Django']);
      addUnique(result.primaryStack, ['Django']);
      addUnique(result.entrypoints, ['manage.py'].filter((item) => snapshot.hasFile(item)));
    }
    if (combinedSignals.includes('flask')) {
      addUnique(result.frameworks, ['Flask']);
      addUnique(result.primaryStack, ['Flask']);
    }
    if (combinedSignals.includes('pytest') || snapshot.hasDirectory('tests')) {
      addUnique(result.testFrameworks, ['pytest']);
      addUnique(result.verificationCommands, [snapshot.hasFile('poetry.lock') ? 'poetry run pytest' : 'python -m pytest']);
    } else {
      addUnique(result.verificationCommands, ['python -m compileall .']);
    }
    addUnique(result.architectureParts, [snapshot.hasDirectory('src') ? 'Python project with source code under src/.' : 'Python project detected from package and source files.']);
    addEvidence(result, 'primaryStack', snapshot.hasFile('pyproject.toml') ? 'pyproject.toml' : 'requirements.txt', 'medium', 'Derived from Python manifests and source files.');
    return result;
  },
};

export const goDetector: ProjectDetector = {
  id: 'go',
  async detect(snapshot) {
    if (!snapshot.hasFile('go.mod')) {
      return null;
    }

    const result = createResult(this.id);
    const goMod = await snapshot.readText('go.mod');
    result.projectName = goMod?.match(/^module\s+(.+)$/m)?.[1]?.split('/').pop();
    addUnique(result.languages, ['Go']);
    addUnique(result.primaryStack, ['Go']);
    addUnique(result.packageManagers, ['Go modules']);
    addUnique(result.buildSystems, ['go']);
    addUnique(result.verificationCommands, ['go test ./...']);
    addUnique(result.importantPaths, ['go.mod', 'cmd', 'internal', 'pkg'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));
    addUnique(result.entrypoints, snapshot.files.filter((file) => file.name === 'main.go').map((file) => file.relativePath));
    addUnique(result.moduleBoundaries, ['cmd entrypoints', 'internal packages', 'pkg reusable packages'].filter((label) => {
      if (label.startsWith('cmd')) return snapshot.hasDirectory('cmd');
      if (label.startsWith('internal')) return snapshot.hasDirectory('internal');
      return snapshot.hasDirectory('pkg');
    }));
    addUnique(result.architectureParts, ['Go module with package boundaries inferred from cmd/internal/pkg directories.']);
    addEvidence(result, 'primaryStack', 'go.mod', 'high', 'Derived from Go module manifest.');
    return result;
  },
};

export const rustDetector: ProjectDetector = {
  id: 'rust',
  async detect(snapshot) {
    if (!snapshot.hasFile('Cargo.toml')) {
      return null;
    }

    const result = createResult(this.id);
    const cargo = await snapshot.readText('Cargo.toml');
    result.projectName = cargo?.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1];
    addUnique(result.languages, ['Rust']);
    addUnique(result.primaryStack, ['Rust']);
    addUnique(result.packageManagers, ['Cargo']);
    addUnique(result.buildSystems, ['Cargo']);
    addUnique(result.verificationCommands, ['cargo test']);
    addUnique(result.importantPaths, ['Cargo.toml', 'src', 'crates'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));
    addUnique(result.entrypoints, ['src/main.rs', 'src/lib.rs'].filter((item) => snapshot.hasFile(item)));
    if (cargo?.includes('[workspace]')) {
      addUnique(result.moduleBoundaries, ['Cargo workspace members']);
      addUnique(result.architectureParts, ['Rust Cargo workspace with member crates.']);
    } else {
      addUnique(result.architectureParts, ['Rust crate organized by Cargo conventions.']);
    }
    addEvidence(result, 'primaryStack', 'Cargo.toml', 'high', 'Derived from Cargo manifest.');
    return result;
  },
};

export const dotnetDetector: ProjectDetector = {
  id: 'dotnet',
  async detect(snapshot) {
    const solutionFiles = snapshot.files.filter((file) => file.extension === '.sln');
    const projectFiles = snapshot.files.filter((file) => file.extension === '.csproj');
    if (solutionFiles.length === 0 && projectFiles.length === 0) {
      return null;
    }

    const result = createResult(this.id);
    addUnique(result.languages, ['C#']);
    addUnique(result.primaryStack, ['.NET']);
    addUnique(result.packageManagers, ['NuGet']);
    addUnique(result.buildSystems, ['dotnet']);
    addUnique(result.verificationCommands, ['dotnet test']);
    addUnique(result.importantPaths, [...solutionFiles, ...projectFiles].map((file) => file.relativePath));
    const firstProject = projectFiles[0];
    const projectText = firstProject ? await snapshot.readText(firstProject.relativePath) : null;
    if (projectText?.includes('Microsoft.NET.Sdk.Web')) {
      addUnique(result.frameworks, ['ASP.NET Core']);
      addUnique(result.primaryStack, ['ASP.NET Core']);
    }
    if (projectFiles.some((file) => file.relativePath.toLowerCase().includes('test'))) {
      addUnique(result.testFrameworks, ['.NET test project']);
    }
    addUnique(result.architectureParts, ['.NET solution or project detected from solution/project files.']);
    addEvidence(result, 'primaryStack', solutionFiles[0]?.relativePath ?? projectFiles[0]?.relativePath ?? '*.csproj', 'high', 'Derived from .NET solution/project files.');
    return result;
  },
};

export const phpDetector: ProjectDetector = {
  id: 'php',
  async detect(snapshot) {
    const composer = parseJsonObject<{ name?: string; description?: string; require?: Record<string, string>; ['require-dev']?: Record<string, string>; scripts?: Record<string, string | string[]> }>(
      await snapshot.readText('composer.json')
    );
    if (!composer) {
      return null;
    }

    const result = createResult(this.id);
    const packages = new Set([
      ...Object.keys(composer.require ?? {}),
      ...Object.keys(composer['require-dev'] ?? {}),
    ]);
    result.projectName = composer.name?.split('/').pop();
    result.projectGoal = composer.description;
    addUnique(result.languages, ['PHP']);
    addUnique(result.primaryStack, ['PHP']);
    addUnique(result.packageManagers, ['Composer']);
    addUnique(result.buildSystems, ['Composer']);
    addUnique(result.importantPaths, ['composer.json', 'app', 'src', 'tests'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));
    if (packages.has('laravel/framework')) {
      addUnique(result.frameworks, ['Laravel']);
      addUnique(result.primaryStack, ['Laravel']);
      addUnique(result.entrypoints, ['artisan'].filter((item) => snapshot.hasFile(item)));
    }
    if (packages.has('symfony/framework-bundle')) {
      addUnique(result.frameworks, ['Symfony']);
      addUnique(result.primaryStack, ['Symfony']);
    }
    if (packages.has('phpunit/phpunit')) {
      addUnique(result.testFrameworks, ['PHPUnit']);
    }
    addUnique(result.verificationCommands, [composer.scripts?.test ? 'composer test' : 'vendor\\bin\\phpunit']);
    addUnique(result.architectureParts, ['PHP project detected from Composer manifest.']);
    addEvidence(result, 'primaryStack', 'composer.json', 'high', 'Derived from Composer dependencies.', [...packages]);
    return result;
  },
};

export const rubyDetector: ProjectDetector = {
  id: 'ruby',
  async detect(snapshot) {
    if (!snapshot.hasFile('Gemfile')) {
      return null;
    }

    const result = createResult(this.id);
    const gemfile = (await snapshot.readText('Gemfile')) ?? '';
    addUnique(result.languages, ['Ruby']);
    addUnique(result.primaryStack, ['Ruby']);
    addUnique(result.packageManagers, ['Bundler']);
    addUnique(result.buildSystems, ['Bundler']);
    addUnique(result.importantPaths, ['Gemfile', 'app', 'config', 'spec', 'test'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));
    if (gemfile.includes('rails')) {
      addUnique(result.frameworks, ['Rails']);
      addUnique(result.primaryStack, ['Rails']);
      addUnique(result.entrypoints, ['config.ru'].filter((item) => snapshot.hasFile(item)));
    }
    if (gemfile.includes('rspec')) {
      addUnique(result.testFrameworks, ['RSpec']);
      addUnique(result.verificationCommands, ['bundle exec rspec']);
    } else {
      addUnique(result.verificationCommands, ['bundle exec ruby -c']);
    }
    addUnique(result.architectureParts, ['Ruby project detected from Gemfile and conventional app/config directories.']);
    addEvidence(result, 'primaryStack', 'Gemfile', 'high', 'Derived from Ruby Gemfile.');
    return result;
  },
};

export const mobileDetector: ProjectDetector = {
  id: 'mobile',
  async detect(snapshot) {
    const hasFlutter = snapshot.hasFile('pubspec.yaml');
    const hasAndroid = snapshot.hasFile('settings.gradle') || snapshot.hasFile('settings.gradle.kts') || snapshot.hasDirectory('android');
    const hasIos = snapshot.files.some((file) => file.extension === '.xcodeproj' || file.extension === '.xcworkspace') || snapshot.hasDirectory('ios');
    const packageJson = parseJsonObject<PackageJsonShape>(await snapshot.readText('package.json'));
    const packages = packageJson ? packageNames(packageJson) : new Set<string>();
    const hasReactNative = packages.has('react-native') || snapshot.hasDirectory('android') && snapshot.hasDirectory('ios') && Boolean(packageJson);

    if (!hasFlutter && !hasAndroid && !hasIos && !hasReactNative) {
      return null;
    }

    const result = createResult(this.id);
    if (hasFlutter) {
      addUnique(result.languages, ['Dart']);
      addUnique(result.frameworks, ['Flutter']);
      addUnique(result.primaryStack, ['Flutter']);
      addUnique(result.packageManagers, ['pub']);
      addUnique(result.buildSystems, ['Flutter']);
      addUnique(result.verificationCommands, ['flutter test']);
      addUnique(result.importantPaths, ['pubspec.yaml', 'lib', 'test'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));
    }
    if (hasReactNative) {
      addUnique(result.frameworks, ['React Native']);
      addUnique(result.primaryStack, ['React Native']);
      addUnique(result.importantPaths, ['android', 'ios', 'src'].filter((item) => snapshot.hasDirectory(item)));
    }
    if (hasAndroid) {
      addUnique(result.frameworks, ['Android']);
      addUnique(result.importantPaths, ['android', 'build.gradle', 'settings.gradle'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));
    }
    if (hasIos) {
      addUnique(result.frameworks, ['iOS']);
      addUnique(result.importantPaths, ['ios']);
    }
    addUnique(result.architectureParts, ['Mobile project signals detected from Flutter, Android, iOS, or React Native files.']);
    addEvidence(result, 'primaryStack', hasFlutter ? 'pubspec.yaml' : packageJson ? 'package.json' : 'workspace', 'medium', 'Derived from mobile framework files.');
    return result;
  },
};

export const infraDetector: ProjectDetector = {
  id: 'infra',
  async detect(snapshot) {
    const dockerFiles = snapshot.files.filter((file) => fileNameEquals(file, 'Dockerfile') || file.name.toLowerCase().startsWith('docker-compose'));
    const terraformFiles = snapshot.files.filter((file) => file.extension === '.tf');
    const helmFiles = snapshot.files.filter((file) => file.name === 'Chart.yaml');
    const k8sFiles = snapshot.files.filter((file) => file.extension === '.yaml' || file.extension === '.yml')
      .filter((file) => file.relativePath.toLowerCase().includes('k8s') || file.relativePath.toLowerCase().includes('kubernetes'));

    if (dockerFiles.length === 0 && terraformFiles.length === 0 && helmFiles.length === 0 && k8sFiles.length === 0) {
      return null;
    }

    const result = createResult(this.id);
    if (dockerFiles.length > 0) {
      addUnique(result.frameworks, ['Docker']);
      addUnique(result.buildSystems, ['Docker']);
      addUnique(result.importantPaths, dockerFiles.map((file) => file.relativePath));
      if (dockerFiles.some((file) => file.name.toLowerCase().startsWith('docker-compose'))) {
        addUnique(result.verificationCommands, ['docker compose config']);
      }
    }
    if (terraformFiles.length > 0) {
      addUnique(result.frameworks, ['Terraform']);
      addUnique(result.buildSystems, ['Terraform']);
      addUnique(result.importantPaths, terraformFiles.slice(0, 5).map((file) => file.relativePath));
      addUnique(result.verificationCommands, ['terraform validate']);
    }
    if (helmFiles.length > 0) {
      addUnique(result.frameworks, ['Helm']);
      addUnique(result.importantPaths, helmFiles.map((file) => file.relativePath));
    }
    if (k8sFiles.length > 0) {
      addUnique(result.frameworks, ['Kubernetes']);
      addUnique(result.importantPaths, k8sFiles.slice(0, 5).map((file) => file.relativePath));
    }
    addUnique(result.primaryStack, result.frameworks);
    addUnique(result.architectureParts, ['Infrastructure/deployment configuration detected.']);
    addEvidence(result, 'primaryStack', result.importantPaths[0] ?? 'workspace', 'medium', 'Derived from infrastructure manifests.');
    return result;
  },
};

export const monorepoDetector: ProjectDetector = {
  id: 'monorepo',
  async detect(snapshot) {
    const hasWorkspaceFile = hasAnyFile(snapshot, [
      'pnpm-workspace.yaml',
      'turbo.json',
      'nx.json',
      'lerna.json',
      'rush.json',
    ]);
    const hasWorkspaceDirs = snapshot.hasDirectory('apps') || snapshot.hasDirectory('packages');
    const hasCargoWorkspace = (await snapshot.readText('Cargo.toml'))?.includes('[workspace]') ?? false;
    const hasMavenModules = (await snapshot.readText('pom.xml'))?.includes('<modules>') ?? false;
    const hasGradleSettings = (await snapshot.readText('settings.gradle'))?.includes('include') || (await snapshot.readText('settings.gradle.kts'))?.includes('include');

    if (!hasWorkspaceFile && !hasWorkspaceDirs && !hasCargoWorkspace && !hasMavenModules && !hasGradleSettings) {
      return null;
    }

    const result = createResult(this.id);
    addUnique(result.frameworks, ['Monorepo']);
    addUnique(result.primaryStack, ['Monorepo']);
    addUnique(result.importantPaths, ['apps', 'packages', 'pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'Cargo.toml', 'pom.xml', 'settings.gradle', 'settings.gradle.kts'].filter((item) => snapshot.hasFile(item) || snapshot.hasDirectory(item)));
    addUnique(result.moduleBoundaries, ['Workspace apps/packages or multi-module projects']);
    addUnique(result.architectureParts, ['Workspace contains monorepo or multi-module project signals.']);
    addUnique(result.riskFlags, ['Multiple project roots may exist; choose the active app/package before implementation work.']);
    addUnique(result.recommendedFirstActions, ['Identify the primary app/package for the next workflow run.']);
    addEvidence(result, 'moduleBoundaries', result.importantPaths[0] ?? 'workspace', 'medium', 'Derived from workspace and multi-module files.');
    return result;
  },
};

export const readmeDetector: ProjectDetector = {
  id: 'readme',
  async detect(snapshot) {
    if (!snapshot.hasFile('README.md')) {
      return null;
    }

    const readme = await snapshot.readText('README.md');
    const result = createResult(this.id);
    result.projectGoal = firstReadmeParagraph(readme);
    result.targetUsers = detectReadmeTargetUsers(readme);
    addUnique(result.importantPaths, ['README.md']);
    addEvidence(result, 'projectGoal', 'README.md', 'medium', 'Derived from README summary.');
    if (result.targetUsers) {
      addEvidence(result, 'targetUsers', 'README.md', 'medium', 'Derived from README audience section.');
    }
    return result;
  },
};

export function createDefaultProjectDetectors(): ProjectDetector[] {
  return [
    monorepoDetector,
    nodeDetector,
    javaDetector,
    pythonDetector,
    goDetector,
    rustDetector,
    dotnetDetector,
    phpDetector,
    rubyDetector,
    mobileDetector,
    infraDetector,
    readmeDetector,
  ];
}

export async function runProjectDetectors(
  snapshot: WorkspaceSnapshot,
  detectors: ProjectDetector[] = createDefaultProjectDetectors()
): Promise<ProjectDetectionResult[]> {
  const results: ProjectDetectionResult[] = [];

  for (const detector of detectors) {
    const result = await detector.detect(snapshot);
    if (result) {
      results.push(result);
    }
  }

  return results;
}
