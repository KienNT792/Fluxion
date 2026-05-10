import { z } from 'zod'
import {
  OnboardingCommandItem,
  OnboardingPacket,
  OnboardingPacketSchema,
  ONBOARDING_PACKET_VERSION
} from '@shared'
import type { OnboardingLogger } from './onboarding-logger'
import { serializeOnboardingError } from './onboarding-logger'
import { uniqueList } from './onboarding-utils'

const codexOnboardingOutputSchema = OnboardingPacketSchema

function extractJsonCandidate(rawOutput: string): string {
  const trimmed = rawOutput.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedMatch?.[1]?.trim()) {
    return fencedMatch[1].trim()
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

const COMMAND_CATEGORY_VALUES = [
  'setup',
  'dev',
  'typecheck',
  'lint',
  'test',
  'build',
  'e2e',
  'db',
  'other'
] as const satisfies readonly OnboardingCommandItem['category'][]
const COMMAND_RISK_VALUES = [
  'safe',
  'needs-approval',
  'destructive'
] as const satisfies readonly OnboardingCommandItem['risk'][]
const COMMAND_CATEGORY_SET = new Set<string>(COMMAND_CATEGORY_VALUES)
const COMMAND_RISK_SET = new Set<string>(COMMAND_RISK_VALUES)
const COMMAND_CATEGORY_ALIASES: Record<string, OnboardingCommandItem['category']> = {
  verify: 'test',
  verification: 'test',
  check: 'test',
  checks: 'test',
  'type-check': 'typecheck',
  typechecking: 'typecheck',
  unit: 'test',
  unittest: 'test',
  'unit-test': 'test'
}
const COMMAND_RISK_ALIASES: Record<string, OnboardingCommandItem['risk']> = {
  low: 'safe',
  readonly: 'safe',
  'read-only': 'safe',
  'no-write': 'safe',
  medium: 'needs-approval',
  high: 'needs-approval',
  approval: 'needs-approval',
  'approval-required': 'needs-approval',
  'requires-approval': 'needs-approval',
  needsapproval: 'needs-approval',
  danger: 'destructive',
  dangerous: 'destructive'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEnumInput(value: unknown): string {
  return textValue(value)
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
}

function inferOnboardingCommandCategory(
  value: unknown,
  commandValue: unknown
): OnboardingCommandItem['category'] {
  const normalized = normalizeEnumInput(value)
  if (COMMAND_CATEGORY_SET.has(normalized)) {
    return normalized as OnboardingCommandItem['category']
  }
  if (COMMAND_CATEGORY_ALIASES[normalized]) {
    return COMMAND_CATEGORY_ALIASES[normalized]
  }

  const command = textValue(commandValue).toLowerCase()
  const combined = `${normalized} ${command}`
  if (/\b(install|bootstrap|restore|dependency|dependencies)\b/.test(combined)) return 'setup'
  if (/\b(dev|develop|serve|start|watch)\b/.test(combined)) return 'dev'
  if (/\b(typecheck|type-check|typechecking|tsc)\b/.test(combined)) return 'typecheck'
  if (/\b(lint|eslint|ruff|checkstyle|format)\b/.test(combined)) return 'lint'
  if (/\b(test|tests|testing|verify|verification|vitest|jest|pytest|rspec)\b/.test(combined)) {
    return 'test'
  }
  if (/\b(build|compile|package)\b/.test(combined)) return 'build'
  if (/\b(e2e|end-to-end|playwright|cypress)\b/.test(combined)) return 'e2e'
  if (/\b(db|database|migrate|migration|prisma)\b/.test(combined)) return 'db'
  return 'other'
}

function inferOnboardingCommandRisk(
  value: unknown,
  commandValue: unknown
): OnboardingCommandItem['risk'] {
  const normalized = normalizeEnumInput(value)
  if (COMMAND_RISK_SET.has(normalized)) {
    return normalized as OnboardingCommandItem['risk']
  }
  if (COMMAND_RISK_ALIASES[normalized]) {
    return COMMAND_RISK_ALIASES[normalized]
  }

  const command = textValue(commandValue).toLowerCase()
  if (
    command.includes(' reset ') ||
    command.includes(' clean ') ||
    command.includes('remove-item') ||
    command.includes('rm -rf') ||
    command.includes('drop database')
  ) {
    return 'destructive'
  }
  if (
    command.includes('install') ||
    command.includes('migrate') ||
    command.includes('deploy') ||
    command.includes('publish')
  ) {
    return 'needs-approval'
  }
  return 'safe'
}

function normalizeCodexOnboardingJson(value: unknown): { value: unknown; warnings: string[] } {
  const root = asRecord(value)
  if (!root || !Array.isArray(root.commands)) {
    return { value, warnings: [] }
  }

  const warnings: string[] = []
  const commands = root.commands.map((commandValue, index) => {
    const command = asRecord(commandValue)
    if (!command) {
      return commandValue
    }

    const category = inferOnboardingCommandCategory(command.category, command.command)
    const risk = inferOnboardingCommandRisk(command.risk, command.command)
    const rawCategory = normalizeEnumInput(command.category)
    const rawRisk = normalizeEnumInput(command.risk)
    if (rawCategory && !COMMAND_CATEGORY_SET.has(rawCategory)) {
      warnings.push(
        `Normalized invalid onboarding command category "${textValue(command.category)}" at commands[${index}].`
      )
    }
    if (rawRisk && !COMMAND_RISK_SET.has(rawRisk)) {
      warnings.push(
        `Normalized invalid onboarding command risk "${textValue(command.risk)}" at commands[${index}].`
      )
    }

    return {
      ...command,
      category,
      risk
    }
  })
  const diagnostics = asRecord(root.diagnostics)
  const diagnosticsWarnings = Array.isArray(diagnostics?.warnings)
    ? diagnostics.warnings.filter((warning): warning is string => typeof warning === 'string')
    : []

  return {
    value: {
      ...root,
      commands,
      diagnostics: diagnostics
        ? {
            ...diagnostics,
            warnings: uniqueList([...diagnosticsWarnings, ...warnings])
          }
        : diagnostics
    },
    warnings
  }
}

export function parseCodexOnboardingOutput(
  rawOutput: string,
  fallbackPacket: OnboardingPacket,
  diagnostics: OnboardingPacket['diagnostics'],
  logger?: OnboardingLogger
): OnboardingPacket {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(extractJsonCandidate(rawOutput))
  } catch (error) {
    logger?.error('codex.parse-json.failed', {
      outputLength: rawOutput.length,
      error: serializeOnboardingError(error)
    })
    throw new Error(
      `Codex onboarding returned non-JSON output: ${
        error instanceof Error ? error.message : 'unknown parse error'
      }`
    )
  }

  try {
    const normalized = normalizeCodexOnboardingJson(parsedJson)
    if (normalized.warnings.length > 0) {
      logger?.warn('codex.output-normalized', {
        warningCount: normalized.warnings.length,
        warnings: normalized.warnings
      })
    }

    const parsed = codexOnboardingOutputSchema.parse(normalized.value)
    return OnboardingPacketSchema.parse({
      ...fallbackPacket,
      ...parsed,
      version: ONBOARDING_PACKET_VERSION,
      generatedAt: diagnostics.generatedAt,
      generationMode: 'codex-assisted',
      diagnostics: {
        ...diagnostics,
        warnings: uniqueList([
          ...fallbackPacket.diagnostics.warnings,
          ...diagnostics.warnings,
          ...parsed.diagnostics.warnings
        ])
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger?.error('codex.schema-validation.failed', {
        issueCount: error.issues.length,
        error: serializeOnboardingError(error)
      })
      throw new Error(
        `Codex onboarding JSON did not match the expected packet shape: ${error.message}`
      )
    }
    throw error
  }
}
