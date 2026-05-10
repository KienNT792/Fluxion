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
  bootstrap: 'setup',
  dependencies: 'setup',
  install: 'setup',
  serve: 'dev',
  start: 'dev',
  development: 'dev',
  verify: 'test',
  verification: 'test',
  check: 'test',
  checks: 'test',
  'type-check': 'typecheck',
  typechecking: 'typecheck',
  format: 'lint',
  formatting: 'lint',
  compile: 'build',
  package: 'build',
  'end-to-end': 'e2e',
  database: 'db',
  migration: 'db',
  migrations: 'db',
  unit: 'test',
  unittest: 'test',
  'unit-test': 'test',
  'unit-tests': 'test',
  testing: 'test',
  tests: 'test'
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

interface NormalizedCommandEnum {
  value: unknown
  normalized: boolean
}

function normalizeOnboardingCommandCategory(value: unknown): NormalizedCommandEnum {
  const normalized = normalizeEnumInput(value)
  if (COMMAND_CATEGORY_SET.has(normalized)) {
    return { value: normalized, normalized: textValue(value) !== normalized }
  }
  if (COMMAND_CATEGORY_ALIASES[normalized]) {
    return { value: COMMAND_CATEGORY_ALIASES[normalized], normalized: true }
  }

  return { value, normalized: false }
}

function normalizeOnboardingCommandRisk(value: unknown): NormalizedCommandEnum {
  const normalized = normalizeEnumInput(value)
  if (COMMAND_RISK_SET.has(normalized)) {
    return { value: normalized, normalized: textValue(value) !== normalized }
  }
  if (COMMAND_RISK_ALIASES[normalized]) {
    return { value: COMMAND_RISK_ALIASES[normalized], normalized: true }
  }

  return { value, normalized: false }
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

    const category = normalizeOnboardingCommandCategory(command.category)
    const risk = normalizeOnboardingCommandRisk(command.risk)
    if (category.normalized) {
      warnings.push(
        `Normalized invalid onboarding command category "${textValue(command.category)}" at commands[${index}].`
      )
    }
    if (risk.normalized) {
      warnings.push(
        `Normalized invalid onboarding command risk "${textValue(command.risk)}" at commands[${index}].`
      )
    }

    return {
      ...command,
      category: category.value,
      risk: risk.value
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
