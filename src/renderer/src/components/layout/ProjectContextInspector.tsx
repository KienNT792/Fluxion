import React from 'react';
import { Briefcase, Code2, FolderTree, Heart, Layers, Shield, Sparkles } from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow.store';
import type { WorkspaceContextStatus } from '@shared';

function getHealthLabel(status: WorkspaceContextStatus): {
  label: string;
  color: string;
} {
  switch (status) {
    case 'ready':
      return { label: 'Ready', color: 'var(--color-semantic-success)' };
    case 'incomplete':
      return { label: 'Incomplete', color: 'var(--color-primary)' };
    case 'missing':
      return { label: 'Not configured', color: 'var(--color-muted)' };
    case 'legacy':
      return { label: 'Legacy format', color: 'var(--color-timeline-done)' };
    default:
      return { label: 'Unknown', color: 'var(--color-muted)' };
  }
}

function ContextSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--color-hairline)' }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="shrink-0" style={{ color: 'var(--color-muted)' }}>
          {icon}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.1em]"
          style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function TagBadge({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline)',
        color: 'var(--color-body)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {label}
    </span>
  );
}

function EmptyField({ hint }: { hint: string }): React.JSX.Element {
  return (
    <p
      className="text-xs italic"
      style={{ color: 'var(--color-muted-soft)' }}
    >
      {hint}
    </p>
  );
}

function ContextHealthDot({
  status,
}: {
  status: WorkspaceContextStatus;
}): React.JSX.Element {
  const { label, color } = getHealthLabel(status);

  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <span
        className="text-xs font-medium"
        style={{ color, fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </span>
    </div>
  );
}

export const ProjectContextInspector: React.FC = () => {
  const contextStatus = useWorkflowStore((state) => state.contextStatus);
  const contextSummary = useWorkflowStore((state) => state.contextSummary);
  const workspacePath = useWorkflowStore((state) => state.workspacePath);
  const setContextSetupOpen = useWorkflowStore((state) => state.setContextSetupOpen);

  if (!contextSummary) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10">
        <Sparkles size={20} style={{ color: 'var(--color-muted-soft)' }} />
        <p
          className="text-center text-xs"
          style={{ color: 'var(--color-muted)', lineHeight: '1.6' }}
        >
          {workspacePath
            ? 'Context not yet initialized.'
            : 'Open a workspace to see project context.'}
        </p>
        {workspacePath && (
          <button
            type="button"
            onClick={() => setContextSetupOpen(true)}
            className="mt-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              color: 'var(--color-primary)',
              background: 'transparent',
              border: '1px solid var(--color-hairline)',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = 'var(--color-surface-card)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
          >
            Initialize Context
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Health */}
      <ContextSection icon={<Heart size={13} />} title="Health">
        <ContextHealthDot status={contextStatus} />
        {contextSummary.readiness.missingItems.length > 0 && (
          <div className="mt-2 space-y-1">
            {contextSummary.readiness.missingItems.slice(0, 4).map((item) => (
              <p
                key={item}
                className="text-[11px]"
                style={{ color: 'var(--color-muted)' }}
              >
                • {item}
              </p>
            ))}
          </div>
        )}
      </ContextSection>

      {/* Project Brief */}
      <ContextSection icon={<Briefcase size={13} />} title="Brief">
        {contextSummary.projectGoal ? (
          <p
            className="text-xs leading-5"
            style={{ color: 'var(--color-body)' }}
          >
            {contextSummary.projectGoal}
          </p>
        ) : (
          <EmptyField hint="No project goal set." />
        )}
        {contextSummary.targetUsers && (
          <p
            className="mt-2 text-[11px]"
            style={{ color: 'var(--color-muted)' }}
          >
            Users: {contextSummary.targetUsers}
          </p>
        )}
      </ContextSection>

      {/* Tech Stack */}
      <ContextSection icon={<Code2 size={13} />} title="Stack">
        {contextSummary.languages.length > 0 ||
        contextSummary.frameworks.length > 0 ||
        contextSummary.primaryStack.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {contextSummary.languages.map((lang) => (
              <TagBadge key={`lang-${lang}`} label={lang} />
            ))}
            {contextSummary.frameworks.map((fw) => (
              <TagBadge key={`fw-${fw}`} label={fw} />
            ))}
            {contextSummary.primaryStack
              .filter(
                (s) =>
                  !contextSummary.languages.includes(s) &&
                  !contextSummary.frameworks.includes(s)
              )
              .map((s) => (
                <TagBadge key={`stack-${s}`} label={s} />
              ))}
          </div>
        ) : (
          <EmptyField hint="No stack detected yet." />
        )}
      </ContextSection>

      {/* Key Paths */}
      <ContextSection icon={<FolderTree size={13} />} title="Key Paths">
        {contextSummary.importantPaths.length > 0 ? (
          <div className="space-y-1">
            {contextSummary.importantPaths.slice(0, 6).map((filePath) => (
              <p
                key={filePath}
                className="truncate text-[11px]"
                style={{
                  color: 'var(--color-body)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {filePath}
              </p>
            ))}
            {contextSummary.importantPaths.length > 6 && (
              <p
                className="text-[10px]"
                style={{ color: 'var(--color-muted-soft)' }}
              >
                +{contextSummary.importantPaths.length - 6} more
              </p>
            )}
          </div>
        ) : (
          <EmptyField hint="No key paths configured." />
        )}
      </ContextSection>

      {/* Components */}
      {contextSummary.components.length > 0 && (
        <ContextSection icon={<Layers size={13} />} title="Components">
          <div className="space-y-2">
            {contextSummary.components.slice(0, 5).map((component) => (
              <div key={component.id} className="flex items-start gap-2">
                <span
                  className="mt-0.5 shrink-0 text-[9px] uppercase"
                  style={{
                    color: 'var(--color-timeline-done)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {component.type}
                </span>
                <span
                  className="truncate text-xs"
                  style={{ color: 'var(--color-body)' }}
                >
                  {component.name}
                </span>
              </div>
            ))}
          </div>
        </ContextSection>
      )}

      {/* Security Policy */}
      {(contextSummary.securityPolicy.sensitivePaths.length > 0 ||
        contextSummary.riskFlags.length > 0) && (
        <ContextSection icon={<Shield size={13} />} title="Security">
          {contextSummary.riskFlags.length > 0 && (
            <div className="space-y-1">
              {contextSummary.riskFlags.slice(0, 3).map((flag) => (
                <p
                  key={flag}
                  className="text-[11px]"
                  style={{ color: 'var(--color-semantic-error)' }}
                >
                  ⚠ {flag}
                </p>
              ))}
            </div>
          )}
          {contextSummary.securityPolicy.sensitivePaths.length > 0 && (
            <div className="mt-2 space-y-1">
              {contextSummary.securityPolicy.sensitivePaths.slice(0, 3).map((p) => (
                <p
                  key={p}
                  className="truncate text-[10px]"
                  style={{
                    color: 'var(--color-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  🔒 {p}
                </p>
              ))}
            </div>
          )}
        </ContextSection>
      )}

      {/* Review CTA — subtle, not prominent per plan rule */}
      {contextStatus !== 'ready' && (
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => setContextSetupOpen(true)}
            className="w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors"
            style={{
              color: 'var(--color-muted)',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline)',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.color = 'var(--color-ink)';
              event.currentTarget.style.borderColor = 'var(--color-hairline-strong)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.color = 'var(--color-muted)';
              event.currentTarget.style.borderColor = 'var(--color-hairline)';
            }}
          >
            Review Context
          </button>
        </div>
      )}
    </div>
  );
};
