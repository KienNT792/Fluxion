import { RefObject, useCallback, useState } from 'react'
import { DEFAULT_MENU_HEIGHT } from './select-options'

export interface MenuPosition {
  left: number
  top: number
  width: number
}

const MENU_GAP = 6
const VIEWPORT_PADDING = 12

export function useSelectPosition(triggerRef: RefObject<HTMLButtonElement | null>): {
  clearMenuPosition: () => void
  menuPosition: MenuPosition | null
  updateMenuPosition: (menuHeight?: number) => void
} {
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)

  const updateMenuPosition = useCallback(
    (menuHeight = DEFAULT_MENU_HEIGHT): void => {
      if (!triggerRef.current) {
        return
      }

      const rect = triggerRef.current.getBoundingClientRect()
      const width = rect.width
      const left = Math.max(
        VIEWPORT_PADDING,
        Math.min(rect.left, window.innerWidth - width - VIEWPORT_PADDING)
      )
      const availableBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING
      const availableAbove = rect.top - VIEWPORT_PADDING
      const shouldOpenAbove = availableBelow < menuHeight && availableAbove > availableBelow

      const top = shouldOpenAbove
        ? Math.max(VIEWPORT_PADDING, rect.top - menuHeight - MENU_GAP)
        : Math.min(rect.bottom + MENU_GAP, window.innerHeight - menuHeight - VIEWPORT_PADDING)

      setMenuPosition({ left, top, width })
    },
    [triggerRef]
  )

  const clearMenuPosition = useCallback(() => {
    setMenuPosition(null)
  }, [])

  return { clearMenuPosition, menuPosition, updateMenuPosition }
}
