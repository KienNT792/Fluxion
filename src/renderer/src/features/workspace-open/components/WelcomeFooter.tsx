import React from 'react'
import { ShieldCheck } from 'lucide-react'

export const WelcomeFooter: React.FC = () => (
  <footer
    className="mx-auto flex w-full items-center justify-between px-8 pb-6 pt-2"
    style={{ maxWidth: '1440px' }}
  >
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
      <ShieldCheck size={14} />
      <span>Fluxion never stores your code. Everything stays on your machine.</span>
    </div>
    <span
      className="text-[11px]"
      style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
    >
      Fluxion v0.1.0
    </span>
  </footer>
)
