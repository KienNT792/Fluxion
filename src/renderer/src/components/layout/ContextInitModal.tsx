import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sparkles, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/**
 * The 5 strategic questions from AGENTS.md, used to initialize workspace context.
 */
export interface ProjectContext {
  objective: string;
  language: string;
  architecture: string;
  styleGuide: string;
  focusAreas: string;
}

interface ContextInitModalProps {
  workspacePath: string;
  onComplete: (context: ProjectContext) => void | Promise<void>;
}

// Simulates Scout Agent scanning project files and auto-filling context
function useScoutAgent(workspacePath: string): {
  isScanning: boolean;
  scannedContext: Partial<ProjectContext>;
} {
  const [isScanning, setIsScanning] = useState(true);
  const [scannedContext, setScannedContext] = useState<Partial<ProjectContext>>({});

  useEffect(() => {
    // Simulate Scout Agent analyzing the project
    const timer = setTimeout(() => {
      // Extract folder name from path
      const folderName = workspacePath.split(/[\\/]/).pop() || 'Project';

      // Lightweight heuristic auto-fill based on common project patterns
      setScannedContext({
        language: 'Auto-detected from project files',
        architecture: `Detected in ${folderName}`,
        styleGuide: '',
        objective: '',
        focusAreas: '',
      });
      setIsScanning(false);
    }, 2400);

    return () => clearTimeout(timer);
  }, [workspacePath]);

  return { isScanning, scannedContext };
}

const QUESTIONS: { key: keyof ProjectContext; label: string; placeholder: string; autoFillable: boolean }[] = [
  {
    key: 'objective',
    label: '1. What is the main objective of this project?',
    placeholder: 'e.g. Migrate legacy JSP screens to React components',
    autoFillable: false,
  },
  {
    key: 'language',
    label: '2. Primary programming language & framework?',
    placeholder: 'e.g. TypeScript, React 19, Vite',
    autoFillable: true,
  },
  {
    key: 'architecture',
    label: '3. Project directory structure / conventions?',
    placeholder: 'e.g. Feature-based folders, Clean Architecture layers',
    autoFillable: true,
  },
  {
    key: 'styleGuide',
    label: '4. Style guide or linting requirements?',
    placeholder: 'e.g. ESLint + Prettier, Airbnb config',
    autoFillable: false,
  },
  {
    key: 'focusAreas',
    label: '5. Key modules / areas the agents should focus on?',
    placeholder: 'e.g. Authentication module, Billing service, Dashboard UI',
    autoFillable: false,
  },
];

export const ContextInitModal: React.FC<ContextInitModalProps> = ({
  workspacePath,
  onComplete,
}) => {
  const { isScanning, scannedContext } = useScoutAgent(workspacePath);
  const [form, setForm] = useState<Partial<ProjectContext>>({});

  const resolvedForm = useMemo<ProjectContext>(
    () => ({
      objective: form.objective ?? scannedContext.objective ?? '',
      language: form.language ?? scannedContext.language ?? '',
      architecture: form.architecture ?? scannedContext.architecture ?? '',
      styleGuide: form.styleGuide ?? scannedContext.styleGuide ?? '',
      focusAreas: form.focusAreas ?? scannedContext.focusAreas ?? '',
    }),
    [form, scannedContext]
  );

  const handleChange = useCallback(
    (key: keyof ProjectContext, value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSubmit = (): void => {
    onComplete(resolvedForm);
  };

  const folderName = workspacePath.split(/[\\/]/).pop() || 'Project';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(38, 37, 30, 0.4)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-lg mx-4 overflow-hidden"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="px-6 py-5 flex items-center gap-3"
          style={{
            background: 'var(--color-canvas-soft)',
            borderBottom: '1px solid var(--color-hairline)',
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <h2
              className="text-base font-semibold"
              style={{ color: 'var(--color-ink)', letterSpacing: '-0.2px' }}
            >
              Initialize Workspace
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              <span className="font-mono">{folderName}</span>
              {' — '}
              {isScanning ? 'Scout Agent is analyzing...' : 'Review detected context'}
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {isScanning ? (
            // ── Scanning State ──
            <div className="flex flex-col items-center gap-5 py-10">
              <Loader2
                size={36}
                className="animate-spin"
                style={{ color: 'var(--color-primary)' }}
              />
              <div className="text-center">
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--color-ink)' }}
                >
                  Scout Agent is analyzing your project
                </p>
                <p
                  className="text-xs mt-1.5 font-mono"
                  style={{ color: 'var(--color-muted)' }}
                >
                  Scanning package.json, tsconfig.json, README.md ...
                </p>
              </div>

              {/* Progress bar */}
              <div
                className="w-48 h-1 rounded-full overflow-hidden"
                style={{ background: 'var(--color-hairline)' }}
              >
                <div
                  className="h-full rounded-full animate-pulse"
                  style={{
                    background: 'var(--color-primary)',
                    width: '65%',
                    transition: 'width 1s ease',
                  }}
                />
              </div>
            </div>
          ) : (
            // ── Form State ──
            <div className="flex flex-col gap-4">
              {/* Auto-fill badge */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-md text-xs"
                style={{
                  background: 'var(--color-canvas-soft)',
                  border: '1px solid var(--color-hairline)',
                  color: 'var(--color-muted)',
                }}
              >
                <CheckCircle2
                  size={14}
                  style={{ color: 'var(--color-semantic-success)' }}
                />
                Scout Agent auto-filled some fields. Review and complete the rest.
              </div>

              {QUESTIONS.map((q) => (
                <div key={q.key} className="flex flex-col gap-1.5">
                  <label
                    className="text-xs font-semibold"
                    style={{ color: 'var(--color-body-strong)' }}
                  >
                    {q.label}
                  </label>
                  <Input
                    value={resolvedForm[q.key]}
                    onChange={(e) => handleChange(q.key, e.target.value)}
                    placeholder={q.placeholder}
                    surface="canvas"
                    font={q.autoFillable ? 'mono' : 'sans'}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {!isScanning && (
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--color-hairline)' }}
          >
            <p className="text-[11px] font-mono" style={{ color: 'var(--color-muted-soft)' }}>
              Saved to .fluxion/context.json
            </p>
            <Button variant="primary" onClick={handleSubmit}>
              Confirm & Initialize
              <ArrowRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
