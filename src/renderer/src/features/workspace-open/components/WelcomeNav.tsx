import React from 'react'
import { BookOpen, Settings, Workflow } from 'lucide-react'
import { Button } from '@renderer/components/ui/Button'

interface WelcomeNavProps {
  onOpenSettings: () => void
}

export const WelcomeNav: React.FC<WelcomeNavProps> = ({ onOpenSettings }) => (
  <nav
    className="mx-auto flex w-full items-center justify-between"
    style={{
      maxWidth: '1440px',
      height: '64px',
      padding: '20px 32px 0 32px'
    }}
  >
    <div className="flex items-center gap-3">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-md"
        style={{
          background: 'var(--color-primary)'
        }}
      >
        <Workflow size={16} style={{ color: 'var(--color-on-primary)' }} />
      </div>
      <span
        className="text-base font-medium"
        style={{
          color: 'var(--color-ink)',
          fontFamily: "'CursorGothic', sans-serif",
          letterSpacing: '-0.3px'
        }}
      >
        Fluxion
      </span>
      <span className="hidden text-xs sm:inline" style={{ color: 'var(--color-muted)' }}>
        Codex orchestration for real repositories
      </span>
    </div>

    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={onOpenSettings}>
        <Settings size={14} />
        Settings
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          window.open('https://github.com/nickmilo/Fluxion', '_blank')
        }}
      >
        <BookOpen size={14} />
        Docs
      </Button>
    </div>
  </nav>
)
