import React from 'react'

interface UseTopbarPopoversOptions {
  isProjectMenuOpen: boolean
  isReadinessPopoverOpen: boolean
  setIsProjectMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsReadinessPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function useTopbarPopovers({
  isProjectMenuOpen,
  isReadinessPopoverOpen,
  setIsProjectMenuOpen,
  setIsReadinessPopoverOpen
}: UseTopbarPopoversOptions): {
  projectMenuRef: React.RefObject<HTMLDivElement | null>
  readinessPopoverRef: React.RefObject<HTMLDivElement | null>
} {
  const projectMenuRef = React.useRef<HTMLDivElement | null>(null)
  const readinessPopoverRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!isProjectMenuOpen && !isReadinessPopoverOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      if (
        isProjectMenuOpen &&
        projectMenuRef.current &&
        target &&
        !projectMenuRef.current.contains(target)
      ) {
        setIsProjectMenuOpen(false)
      }

      if (
        isReadinessPopoverOpen &&
        readinessPopoverRef.current &&
        target &&
        !readinessPopoverRef.current.contains(target)
      ) {
        setIsReadinessPopoverOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsProjectMenuOpen(false)
        setIsReadinessPopoverOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [
    isProjectMenuOpen,
    isReadinessPopoverOpen,
    setIsProjectMenuOpen,
    setIsReadinessPopoverOpen
  ])

  return {
    projectMenuRef,
    readinessPopoverRef
  }
}
