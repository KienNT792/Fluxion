import { z } from 'zod'
import {
  isValidRelativeArtifactPath,
  normalizeArtifactPath
} from '../artifacts/artifact.validation'

export const ArtifactRefSchema = z.object({
  path: z.string().transform(normalizeArtifactPath).refine(isValidRelativeArtifactPath, {
    message: 'Artifact path must be workspace-relative and cannot contain .. segments.'
  }),
  required: z.boolean().optional()
})
