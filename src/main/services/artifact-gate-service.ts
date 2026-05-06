import * as fs from 'fs/promises';
import * as path from 'path';
import { isValidRelativeArtifactPath, normalizeArtifactPath } from '@core';
import { ArtifactRef } from '@shared';

export interface ArtifactGateResult {
  valid: boolean;
  error?: string;
  artifactPaths: string[];
}

export interface ArtifactSnapshot {
  path: string;
  absolutePath: string;
  required: boolean;
  exists: boolean;
  size?: number;
  mtimeMs?: number;
}

interface ResolvedArtifactRef {
  path: string;
  absolutePath: string;
  required: boolean;
}

function artifactFailure(error: string): ArtifactGateResult {
  return {
    valid: false,
    error,
    artifactPaths: [],
  };
}

function artifactSuccess(artifactPaths: string[]): ArtifactGateResult {
  return {
    valid: true,
    artifactPaths,
  };
}

async function statArtifact(absolutePath: string): Promise<{
  exists: boolean;
  size?: number;
  mtimeMs?: number;
}> {
  try {
    const stat = await fs.stat(absolutePath);
    return {
      exists: true,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
    };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT'
    ) {
      return { exists: false };
    }

    throw error;
  }
}

function changedSinceSnapshot(before: ArtifactSnapshot, after: ArtifactSnapshot): boolean {
  if (!after.exists) {
    return false;
  }

  if (!before.exists) {
    return true;
  }

  return before.size !== after.size || before.mtimeMs !== after.mtimeMs;
}

export class ArtifactGateService {
  public async validateRequires(
    workspacePath: string,
    requires: ArtifactRef[] = []
  ): Promise<ArtifactGateResult> {
    const resolved = this.resolveArtifactRefs(workspacePath, requires);
    const existingPaths: string[] = [];

    for (const artifact of resolved) {
      const stat = await statArtifact(artifact.absolutePath);
      if (!stat.exists && artifact.required) {
        return artifactFailure(`Required artifact is missing: ${artifact.path}`);
      }

      if (stat.exists) {
        existingPaths.push(artifact.path);
      }
    }

    return artifactSuccess(existingPaths);
  }

  public async snapshotProduces(
    workspacePath: string,
    produces: ArtifactRef[] = []
  ): Promise<ArtifactSnapshot[]> {
    const resolved = this.resolveArtifactRefs(workspacePath, produces);
    const snapshots: ArtifactSnapshot[] = [];

    for (const artifact of resolved) {
      const stat = await statArtifact(artifact.absolutePath);
      snapshots.push({
        ...artifact,
        ...stat,
      });
    }

    return snapshots;
  }

  public async validateProduces(
    workspacePath: string,
    produces: ArtifactRef[] = [],
    beforeSnapshots: ArtifactSnapshot[] = []
  ): Promise<ArtifactGateResult> {
    const resolved = this.resolveArtifactRefs(workspacePath, produces);
    const snapshotsByPath = new Map(beforeSnapshots.map((snapshot) => [snapshot.path, snapshot]));
    const producedPaths: string[] = [];

    for (const artifact of resolved) {
      const before = snapshotsByPath.get(artifact.path);
      const stat = await statArtifact(artifact.absolutePath);
      const after: ArtifactSnapshot = {
        ...artifact,
        ...stat,
      };
      const changed = before ? changedSinceSnapshot(before, after) : after.exists;

      if (!after.exists && artifact.required) {
        return artifactFailure(`Expected artifact was not produced: ${artifact.path}`);
      }

      if (after.exists && !changed && artifact.required) {
        return artifactFailure(`Expected artifact was not updated by this run: ${artifact.path}`);
      }

      if (after.exists && changed) {
        producedPaths.push(artifact.path);
      }
    }

    return artifactSuccess(producedPaths.sort((a, b) => a.localeCompare(b)));
  }

  private resolveArtifactRefs(
    workspacePath: string,
    refs: ArtifactRef[] = []
  ): ResolvedArtifactRef[] {
    const workspaceRoot = path.resolve(workspacePath);

    return refs.map((ref) => {
      const normalizedPath = normalizeArtifactPath(ref.path);
      if (
        normalizedPath === '.' ||
        !isValidRelativeArtifactPath(normalizedPath)
      ) {
        throw new Error(`Invalid artifact path: ${ref.path}`);
      }

      const absolutePath = path.resolve(workspaceRoot, ...normalizedPath.split('/'));
      const relativeToWorkspace = path.relative(workspaceRoot, absolutePath);
      if (
        relativeToWorkspace === '' ||
        relativeToWorkspace.startsWith('..') ||
        path.isAbsolute(relativeToWorkspace)
      ) {
        throw new Error(`Artifact path escapes the workspace: ${ref.path}`);
      }

      return {
        path: normalizedPath,
        absolutePath,
        required: ref.required ?? true,
      };
    });
  }
}

export const artifactGateService = new ArtifactGateService();
