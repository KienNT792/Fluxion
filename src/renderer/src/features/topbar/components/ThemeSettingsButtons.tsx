import React from 'react'
import { Moon, Settings, Sun } from 'lucide-react'
import { Tooltip } from '@renderer/components/ui/Tooltip'
import { ActionIconButton } from './TopbarButtons'

interface ThemeSettingsButtonsProps {
  dimmed: boolean
  disabled: boolean
  onOpenSettings: () => void
  onToggleTheme: () => void
  theme: 'dark' | 'light'
}

export const ThemeSettingsButtons: React.FC<ThemeSettingsButtonsProps> = ({
  dimmed,
  disabled,
  onOpenSettings,
  onToggleTheme,
  theme
}) => (
  <>
    <Tooltip content="Global Settings">
      <ActionIconButton
        aria-label="Open Global Settings"
        onClick={onOpenSettings}
        disabled={disabled}
        dimmed={dimmed}
      >
        <Settings size={16} />
      </ActionIconButton>
    </Tooltip>

    <Tooltip content={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
      <ActionIconButton
        aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </ActionIconButton>
    </Tooltip>
  </>
)
