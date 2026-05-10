import React from 'react'

interface UseTopbarPopoversOptions {
  isActivityPopoverOpen: boolean
  isProjectMenuOpen: boolean
  isReadinessPopoverOpen: boolean
  setIsActivityPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsProjectMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsReadinessPopoverOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function useTopbarPopovers({
  isActivityPopoverOpen,
  isProjectMenuOpen,
  isReadinessPopoverOpen,
  setIsActivityPopoverOpen,
  setIsProjectMenuOpen,
  setIsReadinessPopoverOpen
}: UseTopbarPopoversOptions): {
  activityPopoverRef: React.RefObject<HTMLDivElement | null>
  projectMenuRef: React.RefObject<HTMLDivElement | null>
  readinessPopoverRef: React.RefObject<HTMLDivElement | null>
} {
  const projectMenuRef = React.useRef<HTMLDivElement | null>(null)
  const activityPopoverRef = React.useRef<HTMLDivElement | null>(null)
  const readinessPopoverRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!isProjectMenuOpen && !isActivityPopoverOpen && !isReadinessPopoverOpen) {
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
        isActivityPopoverOpen &&
        activityPopoverRef.current &&
        target &&
        !activityPopoverRef.current.contains(target)
      ) {
        setIsActivityPopoverOpen(false)
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
        setIsActivityPopoverOpen(false)
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
    isActivityPopoverOpen,
    isProjectMenuOpen,
    isReadinessPopoverOpen,
    setIsActivityPopoverOpen,
    setIsProjectMenuOpen,
    setIsReadinessPopoverOpen
  ])

  return {
    activityPopoverRef,
    projectMenuRef,
    readinessPopoverRef
  }
}
