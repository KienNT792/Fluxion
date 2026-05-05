import { ZodError } from 'zod';

function formatPath(path: PropertyKey[]): string {
  return path.length > 0 ? path.join('.') : '<root>';
}

export function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return 'Invalid payload.';
  }

  return `${formatPath(issue.path)} ${issue.message}`;
}

