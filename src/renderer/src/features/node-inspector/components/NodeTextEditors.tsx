import React from 'react'
import type { AgentNodeData } from '@shared'
import { TextEditorDialog } from '@renderer/components/ui/TextEditorDialog'

interface NodeTextEditorsProps {
  activeTextEditor: 'prompt' | 'systemInstruction' | null
  promptValue: string
  setActiveTextEditor: (editor: 'prompt' | 'systemInstruction' | null) => void
  setLocalData: React.Dispatch<React.SetStateAction<Partial<AgentNodeData>>>
  systemInstructionValue: string
}

export const NodeTextEditors: React.FC<NodeTextEditorsProps> = ({
  activeTextEditor,
  promptValue,
  setActiveTextEditor,
  setLocalData,
  systemInstructionValue
}) => (
  <>
    <TextEditorDialog
      isOpen={activeTextEditor === 'prompt'}
      title="Edit Prompt (Markdown)"
      helperText="Write Markdown instructions. Headings, checklists, bullet lists, and fenced code blocks are preserved and sent to Codex as plain Markdown."
      value={promptValue}
      defaultValue=""
      placeholder={`## Goal
Describe what this agent should do.

## Constraints
- Keep behavior unchanged.
- Use Windows-safe commands.

## Output
Return a concise Markdown summary.`}
      showReset
      onSave={(value) => {
        setLocalData((prev) => ({ ...prev, prompt: value }))
        setActiveTextEditor(null)
      }}
      onCancel={() => setActiveTextEditor(null)}
    />

    <TextEditorDialog
      isOpen={activeTextEditor === 'systemInstruction'}
      title="Node System Override"
      helperText="Workspace/global rules remain the default. This override is only for the selected node."
      value={systemInstructionValue}
      defaultValue=""
      placeholder="You are an expert software engineer..."
      showReset
      onSave={(value) => {
        setLocalData((prev) => ({ ...prev, systemInstruction: value }))
        setActiveTextEditor(null)
      }}
      onCancel={() => setActiveTextEditor(null)}
    />
  </>
)
