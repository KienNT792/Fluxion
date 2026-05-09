export function logRuntimeDebug(
  scope: string,
  message: string,
  details?: Record<string, unknown>
): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const prefix = `[FluxionRuntimeDebug/${scope}]`;

  if (details) {
    console.log(prefix, message, details);
    return;
  }

  console.log(prefix, message);
}
