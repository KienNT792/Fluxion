import React from 'react'
import { ChevronRight } from 'lucide-react'

const FIRST_STEP_CARDS = [
  {
    step: 1,
    title: 'Open your repository',
    body: 'Open an existing project folder to get started.'
  },
  {
    step: 2,
    title: 'Detect project signals',
    body: 'Fluxion analyzes structure, configs, and key files.'
  },
  {
    step: 3,
    title: 'Review generated context',
    body: 'Review AGENTS.md, config, and project brief.'
  },
  {
    step: 4,
    title: 'Run your first workflow',
    body: 'Execute workflows with Codex in a durable context.'
  }
]

export const FirstStepsBand: React.FC = () => (
  <section className="mx-auto w-full px-8 pb-12" style={{ maxWidth: '1440px' }}>
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
        Your first steps with Fluxion
      </h2>
      <button
        type="button"
        className="inline-flex items-center gap-0.5 text-xs font-medium transition-colors hover:opacity-80"
        style={{
          color: 'var(--color-muted)',
          background: 'none',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Learn the workflow
        <ChevronRight size={12} />
      </button>
    </div>

    <div className="grid grid-cols-4 gap-4">
      {FIRST_STEP_CARDS.map((card, index) => (
        <div
          key={card.step}
          className="relative flex flex-col gap-3 rounded-lg px-5 py-5"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)'
          }}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
            style={{
              background: index === 0 ? 'var(--color-primary)' : 'var(--color-surface-strong)',
              color: index === 0 ? 'var(--color-on-primary)' : 'var(--color-ink)'
            }}
          >
            {card.step}
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
            {card.title}
          </span>
          <span className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            {card.body}
          </span>
          {index < FIRST_STEP_CARDS.length - 1 && (
            <span
              className="absolute right-0 top-1/2 hidden h-px w-4 translate-x-full lg:block"
              style={{ background: 'var(--color-hairline-strong)' }}
            />
          )}
        </div>
      ))}
    </div>
  </section>
)
