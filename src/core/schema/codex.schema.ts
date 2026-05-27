import { z } from 'zod'

export const CodexSandboxModeSchema = z.enum(['read-only', 'workspace-write', 'danger-full-access'])

export const CodexApprovalReviewerSchema = z.enum(['user', 'auto_review'])

export const CodexApprovalPolicyModeSchema = z.enum(['untrusted', 'on-request', 'never'])

export const CodexGranularApprovalPolicySchema = z.object({
  kind: z.literal('granular'),
  sandboxApproval: z.boolean().optional(),
  rules: z.boolean().optional(),
  mcpElicitations: z.boolean().optional(),
  requestPermissions: z.boolean().optional(),
  skillApproval: z.boolean().optional()
})

export const CodexApprovalPolicySchema = z.union([
  CodexApprovalPolicyModeSchema,
  CodexGranularApprovalPolicySchema
])

export const CodexWindowsSandboxSchema = z.enum(['unelevated', 'elevated'])
export const CodexVerbositySchema = z.enum(['low', 'medium', 'high'])
export const CodexReasoningSummarySchema = z.enum(['auto', 'concise', 'detailed', 'none'])

export const CodexConfigValueSchema = z.union([z.string(), z.number(), z.boolean()])

const CodexExecutionOptionsObjectSchema = z.object({
  json: z.boolean().default(true),
  sandboxMode: CodexSandboxModeSchema.default('workspace-write'),
  approvalPolicy: CodexApprovalPolicySchema.default('never'),
  approvalsReviewer: CodexApprovalReviewerSchema.optional(),
  windowsSandbox: CodexWindowsSandboxSchema.optional(),
  profile: z.string().min(1).optional(),
  reviewModel: z.string().min(1).optional(),
  serviceTier: z.string().min(1).optional(),
  modelVerbosity: CodexVerbositySchema.optional(),
  modelReasoningSummary: CodexReasoningSummarySchema.optional(),
  hideAgentReasoning: z.boolean().optional(),
  showRawAgentReasoning: z.boolean().optional(),
  config: z.record(z.string(), CodexConfigValueSchema).optional()
})
export const CodexExecutionOptionsSchema = CodexExecutionOptionsObjectSchema.optional().transform(
  (value) => CodexExecutionOptionsObjectSchema.parse(value ?? {})
)

export type CodexSandboxMode = z.infer<typeof CodexSandboxModeSchema>
export type CodexApprovalPolicy = z.infer<typeof CodexApprovalPolicySchema>
export type CodexApprovalReviewer = z.infer<typeof CodexApprovalReviewerSchema>
export type CodexWindowsSandbox = z.infer<typeof CodexWindowsSandboxSchema>
export type CodexExecutionOptions = z.infer<typeof CodexExecutionOptionsObjectSchema>
