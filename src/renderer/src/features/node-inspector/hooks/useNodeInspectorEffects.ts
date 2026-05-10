import React from 'react'

interface UseNodeInspectorEffectsOptions {
  fetchProviderCapabilities: () => Promise<unknown>
  hasFetchedProviderCapabilities: boolean
  reviewFocusRequest?: { nodeId: string } | null
  reviewSectionRef: React.RefObject<HTMLDivElement | null>
  selectedNodeId: string
}

export function useNodeInspectorEffects({
  fetchProviderCapabilities,
  hasFetchedProviderCapabilities,
  reviewFocusRequest,
  reviewSectionRef,
  selectedNodeId
}: UseNodeInspectorEffectsOptions): void {
  React.useEffect(() => {
    if (!hasFetchedProviderCapabilities) {
      void fetchProviderCapabilities()
    }
  }, [fetchProviderCapabilities, hasFetchedProviderCapabilities])

  React.useEffect(() => {
    if (!selectedNodeId || reviewFocusRequest?.nodeId !== selectedNodeId) {
      return
    }

    window.requestAnimationFrame(() => {
      reviewSectionRef.current?.scrollIntoView({
        block: 'start',
        behavior: 'smooth'
      })
      reviewSectionRef.current?.focus()
    })
  }, [reviewFocusRequest, reviewSectionRef, selectedNodeId])
}
