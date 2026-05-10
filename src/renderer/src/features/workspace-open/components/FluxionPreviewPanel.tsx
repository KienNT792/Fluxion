import React from 'react'
import { CheckCircle2, FileText, FolderOpen, Layers, Play, User, Workflow } from 'lucide-react'

const PREVIEW_TIMELINE_ITEMS = [
  {
    label: 'Thinking',
    desc: 'Analyzing repository structure...',
    time: '2.1s',
    bg: 'var(--color-timeline-thinking)'
  },
  {
    label: 'Reading',
    desc: 'Scanning key files and configs...',
    time: '4.3s',
    bg: 'var(--color-timeline-read)'
  },
  {
    label: 'Grepping',
    desc: 'Finding patterns and conventions...',
    time: '3.7s',
    bg: 'var(--color-timeline-grep)'
  },
  {
    label: 'Editing',
    desc: 'Generating context and rules...',
    time: '5.2s',
    bg: 'var(--color-timeline-edit)'
  },
  {
    label: 'Done',
    desc: 'Project context is ready',
    time: '',
    bg: 'var(--color-timeline-done)'
  }
]

export const FluxionPreviewPanel: React.FC = () => (
  <div
    className="hidden rounded-xl lg:flex lg:flex-col"
    style={{
      flex: '0 0 58%',
      maxWidth: '58%',
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)',
      overflow: 'hidden'
    }}
  >
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: '1px solid var(--color-hairline)' }}
    >
      <div className="flex items-center gap-2">
        <Workflow size={14} style={{ color: 'var(--color-primary)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
          Workflow: Initialize Project Context
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: 'var(--color-semantic-success)' }}
        />
        <span
          className="text-[11px] font-medium"
          style={{ color: 'var(--color-semantic-success)' }}
        >
          Ready
        </span>
      </div>
    </div>

    <div className="flex flex-1">
      <div
        className="flex flex-col items-center gap-3 py-4"
        style={{
          width: '44px',
          borderRight: '1px solid var(--color-hairline)',
          background: 'var(--color-canvas-soft)'
        }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
        >
          <Play size={13} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-md">
          <Layers size={13} style={{ color: 'var(--color-muted)' }} />
        </div>
        <div className="flex h-7 w-7 items-center justify-center rounded-md">
          <User size={13} style={{ color: 'var(--color-muted)' }} />
        </div>
      </div>

      <div
        className="flex flex-1 flex-col"
        style={{ borderRight: '1px solid var(--color-hairline)' }}
      >
        <div className="flex gap-0" style={{ borderBottom: '1px solid var(--color-hairline)' }}>
          <span
            className="px-4 py-2 text-xs font-semibold"
            style={{
              color: 'var(--color-ink)',
              borderBottom: '2px solid var(--color-primary)'
            }}
          >
            Flow
          </span>
          <span className="px-4 py-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            Context
          </span>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {PREVIEW_TIMELINE_ITEMS.map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <span
                className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase"
                style={{
                  background: item.bg,
                  color: item.label === 'Done' ? 'var(--color-on-primary)' : 'var(--color-ink)',
                  letterSpacing: '0.88px',
                  lineHeight: '1.4'
                }}
              >
                {item.label}
              </span>
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="text-xs" style={{ color: 'var(--color-body)' }}>
                  {item.desc}
                </span>
                {item.time && (
                  <span
                    className="shrink-0 text-[10px]"
                    style={{
                      color: 'var(--color-muted-soft)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {item.time}
                  </span>
                )}
              </div>
              <CheckCircle2
                size={13}
                className="mt-0.5 shrink-0"
                style={{ color: 'var(--color-semantic-success)' }}
              />
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex flex-col gap-4 p-4"
        style={{ width: '200px', background: 'var(--color-canvas-soft)' }}
      >
        <span
          className="text-[10px] font-semibold uppercase"
          style={{ color: 'var(--color-muted)', letterSpacing: '0.88px' }}
        >
          Context Preview
        </span>

        <div
          className="flex flex-col gap-1 text-xs"
          style={{ color: 'var(--color-body)', fontFamily: 'var(--font-mono)' }}
        >
          <div className="flex items-center gap-1.5">
            <FileText size={11} style={{ color: 'var(--color-muted)' }} />
            AGENTS.md
          </div>
          <div className="flex items-center gap-1.5">
            <FolderOpen size={11} style={{ color: 'var(--color-muted)' }} />
            codex/
          </div>
          <div className="flex items-center gap-1.5 pl-4">
            <FileText size={11} style={{ color: 'var(--color-muted)' }} />
            config.toml
          </div>
          <div className="flex items-center gap-1.5">
            <FolderOpen size={11} style={{ color: 'var(--color-muted)' }} />
            docs/
          </div>
          <div className="flex items-center gap-1.5 pl-4">
            <FileText size={11} style={{ color: 'var(--color-muted)' }} />
            workflow.md
          </div>
        </div>

        <div
          className="rounded-md p-3"
          style={{
            border: '1px solid var(--color-hairline)',
            background: 'var(--color-surface-card)'
          }}
        >
          <span
            className="text-[10px] font-semibold uppercase"
            style={{ color: 'var(--color-muted)', letterSpacing: '0.88px' }}
          >
            Project Brief
          </span>
          <p
            className="mt-2 text-[11px] leading-4"
            style={{ color: 'var(--color-body)', margin: 0, marginTop: '8px' }}
          >
            A React + TypeScript web application with component-based architecture, focusing on
            developer experience and performance.
          </p>
          <p
            className="mt-2 text-[10px] leading-4"
            style={{
              color: 'var(--color-muted)',
              fontFamily: 'var(--font-mono)',
              margin: 0,
              marginTop: '8px'
            }}
          >
            Tech Stack: React, TypeScript, Vite, Tailwind CSS, Vitest
          </p>
        </div>
      </div>
    </div>

    <div
      className="flex items-center justify-between px-4 py-2"
      style={{
        borderTop: '1px solid var(--color-hairline)',
        background: 'var(--color-canvas-soft)'
      }}
    >
      <span
        className="text-[10px]"
        style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
      >
        Model: codex-1
      </span>
      <span
        className="text-[10px]"
        style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
      >
        Mode: Full-Auto
      </span>
      <span
        className="text-[10px]"
        style={{ color: 'var(--color-muted-soft)', fontFamily: 'var(--font-mono)' }}
      >
        Workspace: ~/Projects/fluxion
      </span>
    </div>
  </div>
)
