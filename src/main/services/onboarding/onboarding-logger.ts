export interface OnboardingLogger {
  info: (event: string, metadata?: Record<string, unknown>) => void
  warn: (event: string, metadata?: Record<string, unknown>) => void
  error: (event: string, metadata?: Record<string, unknown>) => void
}

export const consoleOnboardingLogger: OnboardingLogger = {
  info(event, metadata) {
    console.info(`[fluxion:onboarding] ${event}`, metadata ?? {})
  },
  warn(event, metadata) {
    console.warn(`[fluxion:onboarding] ${event}`, metadata ?? {})
  },
  error(event, metadata) {
    console.error(`[fluxion:onboarding] ${event}`, metadata ?? {})
  }
}

export function serializeOnboardingError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    }
  }

  return {
    name: 'UnknownError',
    message: String(error)
  }
}
