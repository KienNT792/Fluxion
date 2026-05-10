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
      title="Edit Prompt"
      helperText="Use the full editor for long node instructions. Save applies the change to this node."
      value={promptValue}
      defaultValue=""
      placeholder="What should this agent do?"
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
