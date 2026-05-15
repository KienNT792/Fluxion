/**
 * @file index.ts
 * @description
 * Barrel file for the Shared Contract Layer.
 * Exports all types, enums, and channels so they can be imported cleanly
 * via the `@shared` alias in both the Main and Renderer processes.
 *
 * Example: `import { IpcChannels, NodeStatus } from '@shared'`
 */

export * from './workflow.types'
export * from './codex-approval-guardrail'
export * from './codex.models'
export * from './openai.models'
export * from './agent.types'
export * from './agent-config.types'
export * from './context.types'
export * from './context.utils'
export * from './onboarding.types'
export * from './memory.types'
export * from './ipc.channels'
export * from './ipc.payloads'
