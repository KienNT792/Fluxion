import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  AgentConfigExportPreview,
  AgentConfigExporterId,
  AgentConfigExporterSummary,
  buildSkippedProjectContextDraft,
  ContextSaveMode,
  ContextScanResult,
  formatProjectContextMarkdown,
  formatReadableProjectContext,
  isProjectContextReadyForFinalSave,
  kickoffIntentLabel,
  normalizeProjectContextDraft,
  ProjectContextDraft,
  ProjectContextField,
  WorkspaceContextSavedPayload,
  WorkspaceContextStatus,
} from '@shared';
import { useModalFocusTrap } from '../../lib/use-modal-focus-trap';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { StatusChip, StatusChipTone } from '../ui/StatusChip';
import { Textarea } from '../ui/Textarea';

type ContextStepId = 'detect' | 'rules' | 'brief' | 'focus' | 'review';
type PreviewTab = 'readable' | 'markdown' | 'json';

interface ContextInitModalProps {
  workspacePath: string;
  initialContext: ProjectContextDraft | null;
  initialStatus: WorkspaceContextStatus;
  onSaved: (payload: WorkspaceContextSavedPayload) => void;
  onClose: () => void;
}

const STEPS: { id: ContextStepId; label: string; description: string }[] = [
  {
    id: 'detect',
    label: 'Detect Workspace',
    description: 'Read workspace signals and choose kickoff mode if needed.',
  },
  {
    id: 'rules',
    label: 'Stable Rules',
    description: 'Capture stack, verification commands, and non-negotiable rules.',
  },
  {
    id: 'brief',
    label: 'Project Brief',
    description: 'Describe the product goal, users, and first milestone.',
  },
  {
    id: 'focus',
    label: 'Agent Focus',
    description: 'Tell agents where to work, what matters, and what is still unknown.',
  },
  {
    id: 'review',
    label: 'Review & Save',
    description: 'Preview the exact context Fluxion will pass to agent runtime.',
  },
] as const;

const KICKOFF_INTENTS: Array<{
  value: NonNullable<ProjectContextDraft['kickoffIntent']>;
  description: string;
}> = [
  {
    value: 'desktop-app',
    description: 'Local-first apps with desktop UX, filesystem, and process orchestration.',
  },
  {
    value: 'cli-tool',
    description: 'Terminal-first utilities, runners, and automation flows.',
  },
  {
    value: 'web-app',
    description: 'Browser-based product surfaces, APIs, and deployment-oriented flows.',
  },
  {
    value: 'not-sure-yet',
    description: 'Keep the brief broad and let the first milestone narrow the direction.',
  },
] as const;

function getWorkspaceName(workspacePath: string): string {
  return workspacePath.split(/[\\/]/).filter(Boolean).pop() || 'Workspace';
}

function mergeDetectedList(existing: string[], detected: string[] | undefined): string[] {
  return normalizeProjectContextDraft({
    workspaceType: 'blank',
    projectName: 'Workspace',
    primaryStack: [...existing, ...(detected ?? [])],
  }).primaryStack;
}

function mergeScanIntoDraft(
  workspacePath: string,
  scan: ContextScanResult | null,
  existingContext: ProjectContextDraft | null,
  initialStatus: WorkspaceContextStatus
): ProjectContextDraft {
  const workspaceName = getWorkspaceName(workspacePath);
  const scanFields = scan?.detectedFields ?? {};
  const merged = normalizeProjectContextDraft(
    {
      version: existingContext?.version,
      workspaceType: existingContext?.workspaceType ?? scan?.workspaceType ?? 'blank',
      projectName: existingContext?.projectName || scan?.projectName || workspaceName,
      kickoffIntent: existingContext?.kickoffIntent,
      projectGoal: existingContext?.projectGoal || scanFields.projectGoal || '',
      targetUsers: existingContext?.targetUsers || scanFields.targetUsers || '',
      primaryStack: mergeDetectedList(existingContext?.primaryStack ?? [], scanFields.primaryStack),
      architectureSummary:
        existingContext?.architectureSummary || scanFields.architectureSummary || '',
      firstMilestone: existingContext?.firstMilestone || '',
      stableRules: existingContext?.stableRules ?? [],
      verificationCommands: mergeDetectedList(
        existingContext?.verificationCommands ?? [],
        scanFields.verificationCommands
      ),
      importantPaths: mergeDetectedList(existingContext?.importantPaths ?? [], scanFields.importantPaths),
      focusAreas: existingContext?.focusAreas ?? [],
      nonGoals: existingContext?.nonGoals ?? [],
      openQuestions: existingContext?.openQuestions ?? [],
      languages: mergeDetectedList(existingContext?.languages ?? [], scanFields.languages),
      frameworks: mergeDetectedList(existingContext?.frameworks ?? [], scanFields.frameworks),
      packageManagers: mergeDetectedList(
        existingContext?.packageManagers ?? [],
        scanFields.packageManagers
      ),
      buildSystems: mergeDetectedList(existingContext?.buildSystems ?? [], scanFields.buildSystems),
      testFrameworks: mergeDetectedList(
        existingContext?.testFrameworks ?? [],
        scanFields.testFrameworks
      ),
      entrypoints: mergeDetectedList(existingContext?.entrypoints ?? [], scanFields.entrypoints),
      moduleBoundaries: mergeDetectedList(
        existingContext?.moduleBoundaries ?? [],
        scanFields.moduleBoundaries
      ),
      generatedOrIgnoredPaths: mergeDetectedList(
        existingContext?.generatedOrIgnoredPaths ?? [],
        scanFields.generatedOrIgnoredPaths
      ),
      riskFlags: mergeDetectedList(existingContext?.riskFlags ?? [], scanFields.riskFlags),
      recommendedFirstActions: mergeDetectedList(
        existingContext?.recommendedFirstActions ?? [],
        scanFields.recommendedFirstActions
      ),
      workspaceTrust: existingContext?.workspaceTrust ?? scanFields.workspaceTrust ?? 'unknown',
      components: existingContext?.components ?? scanFields.components ?? [],
      commandCatalog: existingContext?.commandCatalog ?? scanFields.commandCatalog ?? [],
      agentInstructionSources:
        existingContext?.agentInstructionSources ?? scanFields.agentInstructionSources ?? [],
      securityPolicy: existingContext?.securityPolicy ?? scanFields.securityPolicy,
      readiness: existingContext?.readiness ?? scanFields.readiness,
      contextOnboarding: existingContext?.contextOnboarding,
      sourceEvidence: scan?.sourceEvidence ?? existingContext?.sourceEvidence ?? [],
      lastReviewedAt: existingContext?.lastReviewedAt,
      contextStatus: existingContext?.contextStatus ?? initialStatus,
    },
    {
      workspaceType: scan?.workspaceType ?? existingContext?.workspaceType ?? 'blank',
      projectName: scan?.projectName || existingContext?.projectName || workspaceName,
    }
  );

  if (merged.contextStatus === 'missing' && initialStatus !== 'missing') {
    return {
      ...merged,
      contextStatus: initialStatus,
    };
  }

  return merged;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function fieldLabel(field: ProjectContextField): string {
  switch (field) {
    case 'projectName':
      return 'Project name';
    case 'projectGoal':
      return 'Project goal';
    case 'targetUsers':
      return 'Target users';
    case 'primaryStack':
      return 'Primary stack';
    case 'architectureSummary':
      return 'Architecture summary';
    case 'firstMilestone':
      return 'First milestone';
    case 'stableRules':
      return 'Stable rules';
    case 'verificationCommands':
      return 'Verification commands';
    case 'importantPaths':
      return 'Important paths';
    case 'focusAreas':
      return 'Focus areas';
    case 'nonGoals':
      return 'Non-goals';
    case 'openQuestions':
      return 'Open questions';
    case 'languages':
      return 'Languages';
    case 'frameworks':
      return 'Frameworks';
    case 'packageManagers':
      return 'Package managers';
    case 'buildSystems':
      return 'Build systems';
    case 'testFrameworks':
      return 'Test frameworks';
    case 'entrypoints':
      return 'Entrypoints';
    case 'moduleBoundaries':
      return 'Module boundaries';
    case 'generatedOrIgnoredPaths':
      return 'Generated or ignored paths';
    case 'riskFlags':
      return 'Risk flags';
    case 'recommendedFirstActions':
      return 'Recommended first actions';
    case 'kickoffIntent':
      return 'Kickoff intent';
    case 'workspaceType':
      return 'Workspace type';
    case 'workspaceTrust':
      return 'Workspace trust';
    case 'components':
      return 'Components';
    case 'commandCatalog':
      return 'Command catalog';
    case 'agentInstructionSources':
      return 'Agent instruction sources';
    case 'securityPolicy':
      return 'Security policy';
    case 'readiness':
      return 'Readiness';
    default:
      return field;
  }
}

function getContextStatusState(contextStatus: WorkspaceContextStatus): {
  label: string;
  tone: StatusChipTone;
  detail: string;
} {
  switch (contextStatus) {
    case 'ready':
      return {
        label: 'Ready',
        tone: 'success',
        detail: 'This project context is ready for runtime use.',
      };
    case 'legacy':
      return {
        label: 'Legacy',
        tone: 'warning',
        detail: 'This workspace still uses an older context shape and should be resaved.',
      };
    case 'incomplete':
      return {
        label: 'Incomplete',
        tone: 'warning',
        detail: 'A draft context exists, but it still needs review.',
      };
    default:
      return {
        label: 'Missing',
        tone: 'error',
        detail: 'No project context has been saved for this workspace yet.',
      };
  }
}

function getWorkspaceTypeLabel(workspaceType: ProjectContextDraft['workspaceType']): string {
  switch (workspaceType) {
    case 'existing_with_instructions':
      return 'Repo With Instructions';
    case 'existing':
      return 'Detected Repo';
    default:
      return 'Blank Project';
  }
}

function getWorkspaceTypeDescription(workspaceType: ProjectContextDraft['workspaceType']): string {
  switch (workspaceType) {
    case 'existing_with_instructions':
      return 'Fluxion found repository signals plus an existing instructions layer.';
    case 'existing':
      return 'Fluxion found repository files and can draft context from source evidence.';
    default:
      return 'No strong repository structure was detected, so Fluxion will use kickoff mode.';
  }
}

function getMissingRequirements(draft: ProjectContextDraft): string[] {
  const missing: string[] = [];

  if (!draft.projectGoal.trim()) {
    missing.push('Project goal');
  }

  if (draft.workspaceType === 'blank') {
    const hasTargetStack =
      draft.primaryStack.length > 0 || draft.languages.length > 0 || draft.frameworks.length > 0;
    if (!draft.firstMilestone.trim()) {
      missing.push('First milestone');
    }
    if (!draft.kickoffIntent) {
      missing.push('Kickoff intent');
    }
    if (!hasTargetStack) {
      missing.push('Target stack');
    }
  } else {
    const hasStackSignal =
      draft.primaryStack.length > 0 || draft.languages.length > 0 || draft.frameworks.length > 0;
    const hasStructureSignal =
      draft.architectureSummary.trim().length > 0 || draft.importantPaths.length > 0;
    const hasVerificationSignal =
      draft.verificationCommands.length > 0
      || draft.riskFlags.some((flag) => flag.toLowerCase().includes('verification'));
    if (!hasStackSignal) {
      missing.push('Stack or language');
    }
    if (!hasStructureSignal) {
      missing.push('Architecture or important paths');
    }
    if (!hasVerificationSignal) {
      missing.push('Verification command or risk flag');
    }
  }

  return missing;
}

function getStepState(
  stepId: ContextStepId,
  currentStepId: ContextStepId
): 'pending' | 'active' | 'done' {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStepId);
  const stepIndex = STEPS.findIndex((step) => step.id === stepId);

  if (stepIndex === currentIndex) {
    return 'active';
  }

  return stepIndex < currentIndex ? 'done' : 'pending';
}

const STEP_STATE_TONE: Record<'pending' | 'active' | 'done', StatusChipTone> = {
  pending: 'idle',
  active: 'running',
  done: 'success',
};

const CONFIDENCE_TONE: Record<'high' | 'medium' | 'low', StatusChipTone> = {
  high: 'success',
  medium: 'warning',
  low: 'error',
};

const PreviewTabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs transition-colors"
    style={{
      color: active ? 'var(--color-ink)' : 'var(--color-muted)',
      background: active ? 'var(--color-surface-card)' : 'transparent',
      border: `1px solid ${active ? 'var(--color-hairline)' : 'transparent'}`,
    }}
  >
    {label}
  </button>
);

const EvidenceBadge: React.FC<{
  sourcePath: string;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}> = ({ sourcePath, confidence, note }) => (
  <div
    className="rounded-md px-2.5 py-2"
    style={{
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline)',
    }}
    title={note}
  >
    <div className="flex items-center justify-between gap-2">
      <span
        className="truncate text-[11px]"
        style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
      >
        {sourcePath}
      </span>
      <StatusChip tone={CONFIDENCE_TONE[confidence]} label={confidence} />
    </div>
    {note ? (
      <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--color-muted)' }}>
        {note}
      </p>
    ) : null}
  </div>
);

const ListEditor: React.FC<{
  label: string;
  values: string[];
  placeholder: string;
  hint?: string;
  monospace?: boolean;
  suggestions?: string[];
  onChange: (values: string[]) => void;
}> = ({ label, values, placeholder, hint, monospace = false, suggestions = [], onChange }) => {
  const [pendingValue, setPendingValue] = useState('');

  const handleAdd = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      if (!nextValue || values.includes(nextValue)) {
        setPendingValue('');
        return;
      }

      onChange([...values, nextValue]);
      setPendingValue('');
    },
    [onChange, values]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <label
          className="text-xs font-semibold"
          style={{ color: 'var(--color-body-strong)' }}
        >
          {label}
        </label>
        {hint ? (
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {hint}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={pendingValue}
          onChange={(event) => setPendingValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAdd(pendingValue);
            }
          }}
          placeholder={placeholder}
          surface="canvas"
          font={monospace ? 'mono' : 'sans'}
        />
        <Button
          variant="secondary"
          onClick={() => handleAdd(pendingValue)}
          disabled={!pendingValue.trim()}
        >
          Add
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleAdd(suggestion)}
              className="rounded-full px-2.5 py-1 text-[11px] transition-colors"
              style={{
                background: 'var(--color-canvas-soft)',
                border: '1px solid var(--color-hairline)',
                color: 'var(--color-muted)',
                fontFamily: monospace ? 'var(--font-mono)' : 'inherit',
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {values.length > 0 ? (
          values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((entry) => entry !== value))}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition-colors"
              style={{
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline)',
                color: 'var(--color-ink)',
                fontFamily: monospace ? 'var(--font-mono)' : 'inherit',
              }}
            >
              <span>{value}</span>
              <span style={{ color: 'var(--color-muted)' }}>x</span>
            </button>
          ))
        ) : (
          <div
            className="rounded-md px-3 py-2 text-xs"
            style={{
              color: 'var(--color-muted)',
              border: '1px dashed var(--color-hairline-strong)',
              background: 'var(--color-canvas-soft)',
            }}
          >
            Unknown is better than guessed. Add items only when they are true.
          </div>
        )}
      </div>
    </div>
  );
};

const LineListTextarea: React.FC<{
  label: string;
  values: string[];
  placeholder: string;
  hint?: string;
  rows?: number;
  onChange: (values: string[]) => void;
}> = ({ label, values, placeholder, hint, rows = 4, onChange }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
        {label}
      </label>
      {hint ? (
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
          {hint}
        </span>
      ) : null}
    </div>
    <Textarea
      value={values.join('\n')}
      onChange={(event) => onChange(splitLines(event.target.value))}
      rows={rows}
      placeholder={placeholder}
      surface="canvas"
    />
  </div>
);

export const ContextInitModal: React.FC<ContextInitModalProps> = ({
  workspacePath,
  initialContext,
  initialStatus,
  onSaved,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [currentStep, setCurrentStep] = useState<ContextStepId>('detect');
  const [previewTab, setPreviewTab] = useState<PreviewTab>('readable');
  const [scanResult, setScanResult] = useState<ContextScanResult | null>(null);
  const [draft, setDraft] = useState<ProjectContextDraft>(() =>
    mergeScanIntoDraft(workspacePath, null, initialContext, initialStatus)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [agentConfigExporters, setAgentConfigExporters] = useState<AgentConfigExporterSummary[]>([]);
  const [agentConfigPreview, setAgentConfigPreview] = useState<AgentConfigExportPreview | null>(null);
  const [agentConfigError, setAgentConfigError] = useState<string | null>(null);
  const [isCreatingAgentConfigPreview, setIsCreatingAgentConfigPreview] = useState(false);
  const [isApplyingAgentConfigPreview, setIsApplyingAgentConfigPreview] = useState(false);

  useModalFocusTrap(true, dialogRef);

  useEffect(() => {
    let isCancelled = false;

    const loadContext = async (): Promise<void> => {
      setCurrentStep('detect');
      setPreviewTab('readable');
      setIsLoading(true);
      setLoadError(null);
      setSaveError(null);

      try {
        const [nextScanResult, existingContext] = await Promise.all([
          window.api.scanWorkspaceContext(workspacePath),
          window.api.getContext(workspacePath),
        ]);

        if (isCancelled) {
          return;
        }

        setScanResult(nextScanResult);
        setDraft(
          mergeScanIntoDraft(
            workspacePath,
            nextScanResult,
            existingContext ?? initialContext,
            existingContext?.contextStatus ?? initialStatus
          )
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Failed to read workspace signals. Switch to manual kickoff mode.'
        );
        setScanResult(null);
        setDraft(mergeScanIntoDraft(workspacePath, null, initialContext, initialStatus));
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadContext();

    return () => {
      isCancelled = true;
    };
  }, [initialContext, initialStatus, workspacePath]);

  useEffect(() => {
    let isCancelled = false;

    const loadExporters = async (): Promise<void> => {
      try {
        const exporters = await window.api.listAgentConfigExporters();
        if (!isCancelled) {
          setAgentConfigExporters(exporters);
        }
      } catch {
        if (!isCancelled) {
          setAgentConfigExporters([]);
        }
      }
    };

    void loadExporters();

    return () => {
      isCancelled = true;
    };
  }, []);

  const statusState = useMemo(() => getContextStatusState(draft.contextStatus), [draft.contextStatus]);
  const currentStepIndex = useMemo(
    () => STEPS.findIndex((step) => step.id === currentStep),
    [currentStep]
  );
  const missingRequirements = useMemo(() => getMissingRequirements(draft), [draft]);
  const canSaveFinal = useMemo(() => isProjectContextReadyForFinalSave(draft), [draft]);
  const workspaceName = useMemo(() => getWorkspaceName(workspacePath), [workspacePath]);

  const updateDraft = useCallback(
    (patch: Partial<ProjectContextDraft>) => {
      setDraft((current) => normalizeProjectContextDraft({ ...current, ...patch }));
    },
    []
  );

  const handleSave = useCallback(
    async (mode: ContextSaveMode) => {
      setIsSaving(true);
      setSaveError(null);

      try {
        const skippedAt = new Date().toISOString();
        const payloadDraft =
          mode === 'skip'
            ? normalizeProjectContextDraft({
              ...buildSkippedProjectContextDraft(draft, draft.workspaceType, draft.projectName),
              contextOnboarding: {
                ...draft.contextOnboarding,
                initialPromptDismissedAt: skippedAt,
              },
            })
            : draft;
        const result = await window.api.saveProjectContext(workspacePath, payloadDraft, mode);
        setDraft(result.context);
        onSaved(result);
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : 'Failed to save project context.'
        );
      } finally {
        setIsSaving(false);
      }
    },
    [draft, onSaved, workspacePath]
  );

  const handleCreateAgentConfigPreview = useCallback(
    async (exporterId: AgentConfigExporterId, includeAdvancedConfig = false) => {
      setIsCreatingAgentConfigPreview(true);
      setAgentConfigError(null);

      try {
        const preview = await window.api.createAgentConfigPreview({
          workspacePath,
          exporterId,
          context: draft,
          options: { includeAdvancedConfig },
        });
        setAgentConfigPreview(preview);
      } catch (error) {
        setAgentConfigError(
          error instanceof Error ? error.message : 'Failed to create agent config preview.'
        );
      } finally {
        setIsCreatingAgentConfigPreview(false);
      }
    },
    [draft, workspacePath]
  );

  const handleApplyAgentConfigPreview = useCallback(async () => {
    if (!agentConfigPreview) {
      return;
    }

    setIsApplyingAgentConfigPreview(true);
    setAgentConfigError(null);

    try {
      await window.api.applyAgentConfigPreview({ preview: agentConfigPreview });
      setAgentConfigPreview(null);
    } catch (error) {
      setAgentConfigError(
        error instanceof Error ? error.message : 'Failed to apply agent config preview.'
      );
    } finally {
      setIsApplyingAgentConfigPreview(false);
    }
  }, [agentConfigPreview]);

  const previewMarkdown = useMemo(() => formatProjectContextMarkdown(draft), [draft]);
  const previewReadable = useMemo(() => formatReadableProjectContext(draft), [draft]);
  const previewJson = useMemo(() => JSON.stringify(draft, null, 2), [draft]);
  const showCloseAction = initialStatus !== 'missing' && initialStatus !== 'legacy';
  const canExportAgentConfig = draft.contextStatus === 'ready';

  const renderDetectStep = (): React.ReactNode => (
    <div className="space-y-5">
      <div
        className="rounded-lg px-4 py-4"
        style={{
          background: 'var(--color-canvas-soft)',
          border: '1px solid var(--color-hairline)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={statusState.tone} label={statusState.label} />
          <StatusChip tone="idle" label={getWorkspaceTypeLabel(draft.workspaceType)} />
        </div>
        <h3
          className="mt-3 text-base font-semibold"
          style={{ color: 'var(--color-ink)', letterSpacing: '-0.2px' }}
        >
          {draft.projectName || workspaceName}
        </h3>
        <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
          {getWorkspaceTypeDescription(draft.workspaceType)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
            Project name
          </label>
          <Input
            value={draft.projectName}
            onChange={(event) => updateDraft({ projectName: event.target.value })}
            placeholder="Fluxion"
            surface="canvas"
          />
        </div>

        {draft.workspaceType === 'blank' ? (
          <div className="space-y-3">
            <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
              Kickoff intent
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {KICKOFF_INTENTS.map((intent) => {
                const isActive = draft.kickoffIntent === intent.value;
                return (
                  <button
                    key={intent.value}
                    type="button"
                    onClick={() => updateDraft({ kickoffIntent: intent.value })}
                    className="rounded-lg px-3 py-3 text-left transition-colors"
                    style={{
                      background: isActive ? 'var(--color-surface-card)' : 'var(--color-canvas-soft)',
                      border: `1px solid ${isActive ? 'var(--color-hairline-strong)' : 'var(--color-hairline)'}`,
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {kickoffIntentLabel(intent.value)}
                    </div>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                      {intent.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className="rounded-lg px-4 py-4"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Scanned files
            </span>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Reading workspace signals
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(scanResult?.scannedFiles ?? []).length > 0 ? (
              (scanResult?.scannedFiles ?? []).map((filePath) => (
                <span
                  key={filePath}
                  className="rounded-full px-2.5 py-1 text-[11px]"
                  style={{
                    background: 'var(--color-canvas-soft)',
                    border: '1px solid var(--color-hairline)',
                    color: 'var(--color-ink)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {filePath}
                </span>
              ))
            ) : (
              <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                No strong file signals were detected. Fluxion will use manual kickoff mode.
              </p>
            )}
          </div>
        </div>

        <div
          className="rounded-lg px-4 py-4"
          style={{
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
            >
              Discovered paths
            </span>
            <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Needs your confirmation
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(scanResult?.discoveredPaths ?? []).length > 0 ? (
              (scanResult?.discoveredPaths ?? []).map((entry) => (
                <span
                  key={entry}
                  className="rounded-full px-2.5 py-1 text-[11px]"
                  style={{
                    background: 'var(--color-canvas-soft)',
                    border: '1px solid var(--color-hairline)',
                    color: 'var(--color-ink)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {entry}
                </span>
              ))
            ) : (
              <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                Add important paths later if the first milestone only exists in your head.
              </p>
            )}
          </div>
        </div>
      </div>

      {scanResult?.sourceEvidence.length ? (
        <div className="space-y-3">
          <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
            Evidence behind the draft
          </label>
          <div className="grid gap-3">
            {scanResult.sourceEvidence.map((evidence) => (
              <EvidenceBadge
                key={`${evidence.field}-${evidence.sourcePath}`}
                sourcePath={`${fieldLabel(evidence.field)} · ${evidence.sourcePath}`}
                confidence={evidence.confidence}
                note={evidence.note}
              />
            ))}
          </div>
        </div>
      ) : null}

      {(scanResult?.unresolvedFields ?? []).length > 0 ? (
        <div
          className="rounded-lg px-4 py-4"
          style={{
            background: '#fff8f2',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} style={{ color: 'var(--color-timeline-done)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Unknown is better than guessed
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                Fluxion could not confidently infer these fields yet:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(scanResult?.unresolvedFields ?? []).map((field) => (
                  <span
                    key={field}
                    className="rounded-full px-2.5 py-1 text-[11px]"
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-hairline)',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {fieldLabel(field)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  const renderRulesStep = (): React.ReactNode => (
    <div className="space-y-5">
      <ListEditor
        label="Primary stack"
        values={draft.primaryStack}
        placeholder="TypeScript"
        suggestions={scanResult?.detectedFields.primaryStack}
        onChange={(values) => updateDraft({ primaryStack: values })}
      />

      <ListEditor
        label="Languages"
        values={draft.languages}
        placeholder="Java"
        suggestions={scanResult?.detectedFields.languages}
        onChange={(values) => updateDraft({ languages: values })}
      />

      <ListEditor
        label="Frameworks"
        values={draft.frameworks}
        placeholder="Spring Boot"
        suggestions={scanResult?.detectedFields.frameworks}
        onChange={(values) => updateDraft({ frameworks: values })}
      />

      <ListEditor
        label="Package managers"
        values={draft.packageManagers}
        placeholder="Maven"
        suggestions={scanResult?.detectedFields.packageManagers}
        onChange={(values) => updateDraft({ packageManagers: values })}
      />

      <ListEditor
        label="Verification commands"
        values={draft.verificationCommands}
        placeholder="npm run typecheck"
        hint="These commands should be safe defaults before agents claim done."
        suggestions={scanResult?.detectedFields.verificationCommands}
        monospace
        onChange={(values) => updateDraft({ verificationCommands: values })}
      />

      <LineListTextarea
        label="Stable rules"
        values={draft.stableRules}
        placeholder={'One rule per line.\nPrefer Windows-safe commands.\nKeep runtime logic out of the renderer.'}
        hint="Rules that agents should consistently follow."
        rows={5}
        onChange={(values) => updateDraft({ stableRules: values })}
      />
    </div>
  );

  const renderBriefStep = (): React.ReactNode => (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
          Project goal
        </label>
        <Textarea
          value={draft.projectGoal}
          onChange={(event) => updateDraft({ projectGoal: event.target.value })}
          rows={4}
          placeholder="What is this project trying to achieve?"
          surface="canvas"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
          Target users
        </label>
        <Textarea
          value={draft.targetUsers}
          onChange={(event) => updateDraft({ targetUsers: event.target.value })}
          rows={3}
          placeholder="Who will use or review this project?"
          surface="canvas"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
          Architecture summary
        </label>
        <Textarea
          value={draft.architectureSummary}
          onChange={(event) => updateDraft({ architectureSummary: event.target.value })}
          rows={4}
          placeholder="How is the project structured at a high level?"
          surface="canvas"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-body-strong)' }}>
          First milestone
        </label>
        <Textarea
          value={draft.firstMilestone}
          onChange={(event) => updateDraft({ firstMilestone: event.target.value })}
          rows={3}
          placeholder="What should the first usable milestone deliver?"
          surface="canvas"
        />
      </div>

      <LineListTextarea
        label="Non-goals"
        values={draft.nonGoals}
        placeholder={'One non-goal per line.\nDo not add cloud sync in the first milestone.'}
        rows={4}
        onChange={(values) => updateDraft({ nonGoals: values })}
      />
    </div>
  );

  const renderFocusStep = (): React.ReactNode => (
    <div className="space-y-5">
      <ListEditor
        label="Important paths"
        values={draft.importantPaths}
        placeholder="src/main"
        suggestions={scanResult?.discoveredPaths}
        monospace
        onChange={(values) => updateDraft({ importantPaths: values })}
      />

      <ListEditor
        label="Entrypoints"
        values={draft.entrypoints}
        placeholder="src/main/java/com/example/Application.java"
        suggestions={scanResult?.detectedFields.entrypoints}
        monospace
        onChange={(values) => updateDraft({ entrypoints: values })}
      />

      <ListEditor
        label="Current focus areas"
        values={draft.focusAreas}
        placeholder="workflow execution"
        onChange={(values) => updateDraft({ focusAreas: values })}
      />

      <LineListTextarea
        label="Risk flags"
        values={draft.riskFlags}
        placeholder={'One risk per line.\nMultiple app entrypoints were detected.'}
        rows={4}
        onChange={(values) => updateDraft({ riskFlags: values })}
      />

      <LineListTextarea
        label="Recommended first actions"
        values={draft.recommendedFirstActions}
        placeholder={'One action per line.\nReview duplicate bootstraps before feature work.'}
        rows={4}
        onChange={(values) => updateDraft({ recommendedFirstActions: values })}
      />

      <LineListTextarea
        label="Open questions"
        values={draft.openQuestions}
        placeholder={'One question per line.\nWhich runtime should be treated as default?'}
        rows={5}
        onChange={(values) => updateDraft({ openQuestions: values })}
      />
    </div>
  );

  const renderReviewStep = (): React.ReactNode => (
    <div className="space-y-5">
      <div
        className="rounded-lg px-4 py-4"
        style={{
          background: 'var(--color-canvas-soft)',
          border: '1px solid var(--color-hairline)',
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={statusState.tone} label={`Will save as ${canSaveFinal ? 'Ready' : 'Incomplete'}`} />
          <StatusChip tone="idle" label={getWorkspaceTypeLabel(draft.workspaceType)} />
        </div>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
          This is the context Fluxion will pass to agents through
          {' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>.fluxion/memory/global-context.md</code>
          {' '}
          and
          {' '}
          <code style={{ fontFamily: 'var(--font-mono)' }}>.fluxion/context.json</code>
          .
        </p>
      </div>

      {missingRequirements.length > 0 ? (
        <div
          className="rounded-lg px-4 py-4"
          style={{
            background: '#fff8f2',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} style={{ color: 'var(--color-timeline-done)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Save Context is still blocked
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                Fill these fields before saving the final context:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingRequirements.map((field) => (
                  <span
                    key={field}
                    className="rounded-full px-2.5 py-1 text-[11px]"
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-hairline)',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg px-4 py-4"
          style={{
            background: '#f5fbf7',
            border: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 size={16} style={{ color: 'var(--color-semantic-success)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Ready for runtime
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                The current brief contains the minimum context Fluxion needs to save a ready
                runtime context.
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className="rounded-lg px-4 py-4"
        style={{
          background: 'var(--color-canvas-soft)',
          border: '1px solid var(--color-hairline)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Agent config export
            </p>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
              Export Fluxion context into agent-specific workspace files after the canonical
              context is saved.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => void handleCreateAgentConfigPreview('codex', false)}
              disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
            >
              Codex AGENTS.md
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleCreateAgentConfigPreview('codex', true)}
              disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
            >
              Codex Advanced
            </Button>
          </div>
        </div>

        {!canExportAgentConfig ? (
          <p className="mt-3 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            Save a ready Fluxion context before exporting agent configuration.
          </p>
        ) : null}

        {agentConfigExporters.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {agentConfigExporters
              .filter((exporter) => exporter.id !== 'codex')
              .map((exporter) => (
                <Button
                  key={exporter.id}
                  variant="ghost"
                  onClick={() => void handleCreateAgentConfigPreview(exporter.id)}
                  disabled={!canExportAgentConfig || isCreatingAgentConfigPreview}
                >
                  {exporter.label}
                  {' '}
                  {exporter.status === 'notImplemented' ? '(scaffold)' : ''}
                </Button>
              ))}
          </div>
        ) : null}

        {agentConfigError ? (
          <p className="mt-3 text-xs" style={{ color: 'var(--color-semantic-error)' }}>
            {agentConfigError}
          </p>
        ) : null}

        {agentConfigPreview ? (
          <div className="mt-4 space-y-3">
            {agentConfigPreview.warnings.length > 0 ? (
              <div className="rounded-md px-3 py-3" style={{ background: '#fff8f2' }}>
                {agentConfigPreview.warnings.map((warning) => (
                  <p
                    key={warning}
                    className="text-xs leading-5"
                    style={{ color: 'var(--color-body)' }}
                  >
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}

            {agentConfigPreview.operations.length > 0 ? (
              <div className="space-y-3">
                {agentConfigPreview.operations.map((operation) => (
                  <div
                    key={`${operation.action}:${operation.relativePath}`}
                    className="rounded-md px-3 py-3"
                    style={{
                      background: 'var(--color-surface-card)',
                      border: '1px solid var(--color-hairline)',
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: 'var(--color-ink)' }}
                      >
                        {operation.action} {operation.relativePath}
                      </span>
                      <StatusChip tone="idle" label={operation.action} />
                    </div>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                      {operation.description}
                    </p>
                    <pre
                      className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md px-3 py-3 text-[11px] leading-5"
                      style={{
                        background: 'var(--color-canvas-soft)',
                        color: 'var(--color-ink)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {operation.content}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                No file operations are available for this exporter yet.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setAgentConfigPreview(null)}
                disabled={isApplyingAgentConfigPreview}
              >
                Clear Preview
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleApplyAgentConfigPreview()}
                disabled={
                  isApplyingAgentConfigPreview || agentConfigPreview.operations.length === 0
                }
              >
                {isApplyingAgentConfigPreview ? 'Applying...' : 'Apply Export'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  const renderStepContent = (): React.ReactNode => {
    switch (currentStep) {
      case 'rules':
        return renderRulesStep();
      case 'brief':
        return renderBriefStep();
      case 'focus':
        return renderFocusStep();
      case 'review':
        return renderReviewStep();
      default:
        return renderDetectStep();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5"
      style={{ background: 'rgba(38, 37, 30, 0.42)', backdropFilter: 'blur(8px)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Project Context Setup"
        tabIndex={-1}
        className="flex h-full max-h-[80vh] w-full max-w-[1120px] flex-col overflow-hidden"
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div
          className="flex items-start justify-between gap-4 px-6 py-5"
          style={{
            background: 'var(--color-canvas-soft)',
            borderBottom: '1px solid var(--color-hairline)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-ink)', letterSpacing: '-0.24px' }}
                >
                  Project Context Setup
                </h2>
                <StatusChip tone={statusState.tone} label={statusState.label} />
              </div>
              <p className="mt-1 text-sm leading-6" style={{ color: 'var(--color-body)' }}>
                Set the context your agents will actually run with for
                {' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>{workspaceName}</span>
                .
              </p>
            </div>
          </div>

          {showCloseAction ? (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
          <aside
            className="border-r px-5 py-5"
            style={{ borderColor: 'var(--color-hairline)', background: 'var(--color-canvas)' }}
          >
            <div className="space-y-3">
              {STEPS.map((step, index) => {
                const stepState = getStepState(step.id, currentStep);
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setCurrentStep(step.id)}
                    className="w-full rounded-lg px-3 py-3 text-left transition-colors"
                    style={{
                      background:
                        stepState === 'active'
                          ? 'var(--color-surface-card)'
                          : 'transparent',
                      border: `1px solid ${stepState === 'active'
                        ? 'var(--color-hairline)'
                        : 'transparent'}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px]"
                          style={{
                            background: 'var(--color-canvas-soft)',
                            border: '1px solid var(--color-hairline)',
                            color: 'var(--color-ink)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {index + 1}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                          {step.label}
                        </span>
                      </div>
                      <StatusChip tone={STEP_STATE_TONE[stepState]} label={stepState} />
                    </div>
                    <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                      {step.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
                <Loader2
                  size={34}
                  className="animate-spin"
                  style={{ color: 'var(--color-primary)' }}
                />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    Reading workspace signals
                  </p>
                  <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                    Fluxion is checking project manifests, source roots, workspace files, and
                    instructions before it drafts agent context.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {loadError ? (
                  <div
                    className="rounded-lg px-4 py-3"
                    style={{
                      background: '#fff8f2',
                      border: '1px solid var(--color-hairline)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} style={{ color: 'var(--color-timeline-done)' }} />
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                          Manual kickoff mode
                        </p>
                        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-body)' }}>
                          {loadError}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {renderStepContent()}
              </div>
            )}
          </section>

          <aside
            className="flex min-h-0 flex-col border-l"
            style={{
              borderColor: 'var(--color-hairline)',
              background: 'var(--color-canvas-soft)',
            }}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <span
                  className="text-[11px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  Agent Preview
                </span>
                <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  This is the context Fluxion will pass to agents.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-5">
              <PreviewTabButton
                active={previewTab === 'readable'}
                onClick={() => setPreviewTab('readable')}
                label="Readable Brief"
              />
              <PreviewTabButton
                active={previewTab === 'markdown'}
                onClick={() => setPreviewTab('markdown')}
                label="global-context.md"
              />
              <PreviewTabButton
                active={previewTab === 'json'}
                onClick={() => setPreviewTab('json')}
                label="context.json"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {previewTab === 'readable' ? (
                <div
                  className="rounded-lg px-4 py-4"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  <pre
                    className="whitespace-pre-wrap text-xs leading-6"
                    style={{ color: 'var(--color-body)', fontFamily: 'inherit' }}
                  >
                    {previewReadable}
                  </pre>
                </div>
              ) : null}

              {previewTab === 'markdown' ? (
                <div
                  className="rounded-lg px-4 py-4"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  <pre
                    className="whitespace-pre-wrap text-[11px] leading-6"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                  >
                    {previewMarkdown}
                  </pre>
                </div>
              ) : null}

              {previewTab === 'json' ? (
                <div
                  className="rounded-lg px-4 py-4"
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline)',
                  }}
                >
                  <pre
                    className="whitespace-pre-wrap text-[11px] leading-6"
                    style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}
                  >
                    {previewJson}
                  </pre>
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--color-hairline)' }}
        >
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 ? (
              <Button
                variant="secondary"
                onClick={() => setCurrentStep(STEPS[currentStepIndex - 1]?.id ?? 'detect')}
                disabled={isLoading || isSaving}
              >
                <ArrowLeft size={14} />
                Back
              </Button>
            ) : showCloseAction ? (
              <Button variant="secondary" onClick={onClose} disabled={isLoading || isSaving}>
                Close
              </Button>
            ) : null}

            <Button
              variant="ghost"
              onClick={() => void handleSave('skip')}
              disabled={isLoading || isSaving}
            >
              Skip for now
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {saveError ? (
              <span className="text-xs" style={{ color: 'var(--color-semantic-error)' }}>
                {saveError}
              </span>
            ) : null}

            <Button
              variant="secondary"
              onClick={() => void handleSave('draft')}
              disabled={isLoading || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </Button>

            {currentStep !== 'review' ? (
              <Button
                variant="primary"
                onClick={() => setCurrentStep(STEPS[currentStepIndex + 1]?.id ?? 'review')}
                disabled={isLoading || isSaving}
              >
                Next
                <ArrowRight size={14} />
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => void handleSave('final')}
                disabled={isLoading || isSaving || !canSaveFinal}
              >
                {isSaving ? 'Saving...' : 'Save Context'}
                <ArrowRight size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
