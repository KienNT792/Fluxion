import { z } from 'zod'

export const CodexSandboxModeSchema = z.enum(['read-only', 'workspace-write', 'danger-full-access'])

export const CodexApprovalPolicySchema = z.enum(['untrusted', 'on-request', 'never'])

export const CodexWindowsSandboxSchema = z.enum(['unelevated', 'elevated'])

export const CodexConfigValueSchema = z.union([z.string(), z.number(), z.boolean()])

const CodexExecutionOptionsObjectSchema = z.object({
  json: z.boolean().default(true),
  sandboxMode: CodexSandboxModeSchema.default('workspace-write'),
  approvalPolicy: CodexApprovalPolicySchema.default('never'),
  windowsSandbox: CodexWindowsSandboxSchema.optional(),
  profile: z.string().min(1).optional(),
  config: z.record(z.string(), CodexConfigValueSchema).optional()
})
export const CodexExecutionOptionsSchema = CodexExecutionOptionsObjectSchema.optional().transform(
  (value) => CodexExecutionOptionsObjectSchema.parse(value ?? {})
)

export type CodexSandboxMode = z.infer<typeof CodexSandboxModeSchema>
export type CodexApprovalPolicy = z.infer<typeof CodexApprovalPolicySchema>
export type CodexWindowsSandbox = z.infer<typeof CodexWindowsSandboxSchema>
export type CodexExecutionOptions = z.infer<typeof CodexExecutionOptionsObjectSchema>
