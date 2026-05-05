export function normalizeArtifactPath(value: string): string {
  return value.trim().replaceAll('\\', '/').replace(/\/+/g, '/');
}

export function isValidRelativeArtifactPath(value: string): boolean {
  const normalized = normalizeArtifactPath(value);

  if (!normalized) {
    return false;
  }

  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    return false;
  }

  return !normalized.split('/').some((segment) => segment === '..');
}

