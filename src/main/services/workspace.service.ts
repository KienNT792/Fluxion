import * as fs from 'fs/promises';
import * as path from 'path';
import { type FSWatcher, watch } from 'chokidar';
import { z } from 'zod';
import { ulid } from 'ulid';
import { 
  IpcChannels, 
  OPENAI_DEFAULT_MODEL,
  Workflow, 
  WorkflowNode, 
  WorkspaceOpenedPayload, 
  WorkspaceFileChangedPayload,
  WorkflowSavedPayload,
  WorkflowMetadata,
  FluxionSchemaVersion
} from '@shared';
import { memoryManager } from './memory-manager';

const workflowNodeDataSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    label: z.string().optional(),
    prompt: z.string(),
    systemInstruction: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
    reasoningLevel: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
  })
  .passthrough();

const workflowFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  fluxionVersion: z.string().optional(),
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string().optional(),
      label: z.string().optional(),
      data: workflowNodeDataSchema,
      position: z.object({
        x: z.number(),
        y: z.number(),
      }),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string().min(1),
      source: z.string().min(1),
      target: z.string().min(1),
      label: z.string().optional(),
    })
  ),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

type WorkflowFile = z.infer<typeof workflowFileSchema>;
type SupportedChangeType = 'add' | 'change' | 'unlink';

function sanitizeWorkflowNodeData(
  data: WorkflowFile['nodes'][number]['data']
): WorkflowNode['data'] {
  const model =
    typeof data.model === 'string' && data.model.trim().length > 0
      ? data.model.trim()
      : OPENAI_DEFAULT_MODEL;
  const provider = data.provider === 'openai' ? 'openai' : 'openai';
  const normalizedModel = data.provider === 'openai' ? model : OPENAI_DEFAULT_MODEL;

  return {
    ...data,
    provider,
    model: normalizedModel,
  };
}

function normalizePathForCompare(value: string): string {
  return path.resolve(value).replaceAll('\\', '/').toLowerCase();
}

/**
 * Windows-safe slugify function for generating filenames.
 */
function slugify(text: string): string {
  let slug = text
    .toString()
    .toLowerCase()
    .normalize('NFD') // separate accents
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, '-') // replace spaces with -
    .replace(/[^\w-]+/g, '') // remove all non-word chars
    .replace(/--+/g, '-') // replace multiple - with single -
    .replace(/^-+/, '') // trim - from start
    .replace(/-+$/, ''); // trim - from end

  if (!slug) {
    slug = 'workflow';
  }

  // Windows reserved names
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reserved.test(slug)) {
    slug = `${slug}-file`;
  }

  return slug;
}

export class WorkspaceService {
  private static instance: WorkspaceService;
  private watcher: FSWatcher | null = null;
  private currentWorkspacePath: string | null = null;
  private currentSender: Electron.WebContents | null = null;
  
  // Watcher is now scoped to the workspace directory, but we specifically 
  // track writes to the active workflow to ignore them
  private lastInternalWorkflowWritePath: string | null = null;
  private lastInternalWorkflowWriteAt = 0;
  
  // Track the active workflow file path so the watcher knows what's important
  private activeWorkflowFilePath: string | null = null;

  private constructor() {
    // Singleton
  }

  public static getInstance(): WorkspaceService {
    if (!WorkspaceService.instance) {
      WorkspaceService.instance = new WorkspaceService();
    }
    return WorkspaceService.instance;
  }

  public getLegacyWorkflowFilePath(workspacePath: string): string {
    return path.join(path.resolve(workspacePath), '.fluxion', 'workflow.json');
  }

  public getWorkflowsDirectory(workspacePath: string): string {
    return path.join(path.resolve(workspacePath), '.fluxion', 'workflows');
  }

  public getContextFilePath(workspacePath: string): string {
    return path.join(path.resolve(workspacePath), '.fluxion', 'context.json');
  }

  /**
   * Scans the workspace for all workflow files (.fluxion.json and legacy workflow.json)
   */
  public async scanWorkflows(workspacePath: string): Promise<{ 
    workflows: WorkflowMetadata[], 
    legacyWorkflowDetected: boolean,
    legacyWorkflowPath?: string
  }> {
    const workflows: WorkflowMetadata[] = [];
    let legacyWorkflowDetected = false;
    let legacyWorkflowPath: string | undefined;

    const resolvedWorkspacePath = path.resolve(workspacePath);
    
    // 1. Check for legacy workflow
    const legacyPath = this.getLegacyWorkflowFilePath(resolvedWorkspacePath);
    try {
      const stat = await fs.stat(legacyPath);
      if (stat.isFile()) {
        const raw = await fs.readFile(legacyPath, 'utf-8');
        try {
          const parsed = workflowFileSchema.parse(JSON.parse(raw));
          workflows.push({
            id: parsed.id,
            name: parsed.name,
            description: parsed.description,
            tags: parsed.tags,
            fluxionVersion: (parsed.fluxionVersion as FluxionSchemaVersion) || '1.0',
            createdAt: parsed.createdAt || new Date(stat.birthtime).toISOString(),
            updatedAt: parsed.updatedAt || new Date(stat.mtime).toISOString(),
            filePath: legacyPath,
            isLegacy: true
          });
          legacyWorkflowDetected = true;
          legacyWorkflowPath = legacyPath;
        } catch (e) {
          console.warn(`Failed to parse legacy workflow.json`, e);
        }
      }
    } catch {
      // Legacy file doesn't exist, ignore
    }

    // 2. Check for new workflows
    const workflowsDir = this.getWorkflowsDirectory(resolvedWorkspacePath);
    try {
      await fs.mkdir(workflowsDir, { recursive: true });
      const entries = await fs.readdir(workflowsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.fluxion.json')) {
          const filePath = path.join(workflowsDir, entry.name);
          try {
            const raw = await fs.readFile(filePath, 'utf-8');
            const parsed = workflowFileSchema.parse(JSON.parse(raw));
            
            workflows.push({
              id: parsed.id,
              name: parsed.name,
              description: parsed.description,
              tags: parsed.tags,
              fluxionVersion: (parsed.fluxionVersion as FluxionSchemaVersion) || '1.0',
              createdAt: parsed.createdAt || new Date().toISOString(),
              updatedAt: parsed.updatedAt || new Date().toISOString(),
              filePath: filePath,
              isLegacy: false
            });
          } catch (e) {
            console.warn(`Failed to parse workflow file: ${entry.name}`, e);
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to read workflows directory`, e);
    }

    // Sort descending by updatedAt
    workflows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return { workflows, legacyWorkflowDetected, legacyWorkflowPath };
  }

  public async loadWorkspace(
    workspacePath: string,
    sender: Electron.WebContents
  ): Promise<WorkspaceOpenedPayload> {
    const resolvedWorkspacePath = path.resolve(workspacePath);

    await memoryManager.initWorkspace(resolvedWorkspacePath);

    let isNewWorkspace = false;
    let { workflows, legacyWorkflowDetected } = await this.scanWorkflows(resolvedWorkspacePath);

    let activeWorkflowFilePath: string;
    let workflow: Workflow;

    // If no workflows exist, create a default one
    if (workflows.length === 0) {
      workflow = this.createDefaultWorkflow(resolvedWorkspacePath);
      activeWorkflowFilePath = path.join(
        this.getWorkflowsDirectory(resolvedWorkspacePath), 
        `${slugify(workflow.name)}.fluxion.json`
      );
      
      await this.writeWorkflowToDisk(activeWorkflowFilePath, workflow);
      isNewWorkspace = true;
      
      // Update metadata list
      workflows.push({
        id: workflow.id,
        name: workflow.name,
        fluxionVersion: '1.0',
        createdAt: workflow.createdAt!,
        updatedAt: workflow.updatedAt!,
        filePath: activeWorkflowFilePath,
        isLegacy: false
      });
    } else {
      // Preserve the currently active workflow when possible (for explicit switch),
      // otherwise fall back to the most recently updated workflow.
      const preferredActivePath = this.activeWorkflowFilePath
        ? normalizePathForCompare(this.activeWorkflowFilePath)
        : null;
      const preferredActiveWorkflow = preferredActivePath
        ? workflows.find(
            (candidate) => normalizePathForCompare(candidate.filePath) === preferredActivePath
          )
        : undefined;
      const workflowToLoad = preferredActiveWorkflow ?? workflows[0];
      activeWorkflowFilePath = workflowToLoad.filePath;
      workflow = await this.readWorkflowFromDisk(activeWorkflowFilePath);
    }

    this.activeWorkflowFilePath = activeWorkflowFilePath;
    await this.startWatcher(resolvedWorkspacePath, sender);

    // Check if context.json already exists
    const contextFilePath = this.getContextFilePath(resolvedWorkspacePath);
    let hasContext = false;
    try {
      await fs.access(contextFilePath);
      hasContext = true;
    } catch {
      hasContext = false;
    }

    return {
      workspacePath: resolvedWorkspacePath,
      workflow,
      activeWorkflowFilePath,
      activeWorkflowId: workflow.id,
      workflows,
      isNewWorkspace,
      hasContext,
      legacyWorkflowDetected
    };
  }

  public async saveWorkflow(
    workspacePath: string,
    workflow: Workflow,
    activeWorkflowFilePath: string
  ): Promise<WorkflowSavedPayload> {
    const resolvedWorkspacePath = path.resolve(workspacePath);
    const savedWorkflow = await this.writeWorkflowToDisk(activeWorkflowFilePath, workflow);

    return {
      workspacePath: resolvedWorkspacePath,
      workflowFilePath: activeWorkflowFilePath,
      savedAt: savedWorkflow.updatedAt ?? new Date().toISOString(),
    };
  }

  /**
   * Creates a new workflow file in the workflows directory
   */
  public async createWorkflow(
    workspacePath: string,
    name: string
  ): Promise<{ workflow: Workflow, workflowFilePath: string }> {
    const resolvedWorkspacePath = path.resolve(workspacePath);
    
    const workflow: Workflow = {
      id: ulid(),
      name,
      fluxionVersion: '1.0',
      nodes: [],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const workflowsDir = this.getWorkflowsDirectory(resolvedWorkspacePath);
    await fs.mkdir(workflowsDir, { recursive: true });
    
    // Generate a safe unique filename
    let slug = slugify(name);
    let filePath = path.join(workflowsDir, `${slug}.fluxion.json`);
    
    // Anti-collision loop
    let counter = 1;
    while (true) {
      try {
        await fs.access(filePath);
        filePath = path.join(workflowsDir, `${slug}-${counter}.fluxion.json`);
        counter++;
      } catch {
        break; // File doesn't exist, safe to use
      }
    }

    await this.writeWorkflowToDisk(filePath, workflow);
    return { workflow, workflowFilePath: filePath };
  }

  /**
   * Loads a specific workflow file from disk
   */
  public async loadWorkflowFile(filePath: string): Promise<Workflow> {
    this.activeWorkflowFilePath = filePath;
    return this.readWorkflowFromDisk(filePath);
  }

  /**
   * Deletes a workflow file
   */
  public async deleteWorkflow(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      if (this.activeWorkflowFilePath === filePath) {
        this.activeWorkflowFilePath = null;
      }
    } catch (e) {
      console.error(`Failed to delete workflow at ${filePath}`, e);
    }
  }

  public async dispose(): Promise<void> {
    await this.closeWatcher();
    this.currentWorkspacePath = null;
    this.currentSender = null;
    this.activeWorkflowFilePath = null;
  }

  public async saveContext(
    workspacePath: string,
    context: Record<string, string>
  ): Promise<void> {
    const resolvedWorkspacePath = path.resolve(workspacePath);
    const contextFilePath = this.getContextFilePath(resolvedWorkspacePath);
    await fs.mkdir(path.dirname(contextFilePath), { recursive: true });
    await fs.writeFile(
      contextFilePath,
      JSON.stringify({ ...context, createdAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  }

  private createDefaultWorkflow(workspacePath: string): Workflow {
    const workspaceName = path.basename(workspacePath) || 'Fluxion';
    const now = new Date().toISOString();
    return {
      id: ulid(),
      name: `${workspaceName} Workflow`,
      fluxionVersion: '1.0',
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private normalizeWorkflow(workflowFile: WorkflowFile): Workflow {
    return {
      id: workflowFile.id,
      name: workflowFile.name,
      description: workflowFile.description,
      tags: workflowFile.tags,
      fluxionVersion: (workflowFile.fluxionVersion as FluxionSchemaVersion) || '1.0',
      createdAt: workflowFile.createdAt,
      updatedAt: workflowFile.updatedAt,
      nodes: workflowFile.nodes.map((node) => {
        const normalizedData = sanitizeWorkflowNodeData(node.data);

        return {
          id: node.id,
          type: node.type ?? 'agentNode',
          label:
            node.label ||
            (typeof normalizedData.label === 'string' && normalizedData.label.trim()
              ? normalizedData.label
              : node.id),
          data: normalizedData,
          position: node.position,
        };
      }),
      edges: workflowFile.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
      })),
    };
  }

  private async readWorkflowFromDisk(workflowFilePath: string): Promise<Workflow> {
    const raw = await fs.readFile(workflowFilePath, 'utf-8');
    const parsed = workflowFileSchema.parse(JSON.parse(raw));
    return this.normalizeWorkflow(parsed);
  }

  private async writeWorkflowToDisk(
    workflowFilePath: string,
    workflow: Workflow
  ): Promise<Workflow> {
    const normalizedWorkflow = this.normalizeWorkflow(workflowFileSchema.parse(workflow));
    const savedWorkflow: Workflow = {
      ...normalizedWorkflow,
      updatedAt: new Date().toISOString(),
    };

    await fs.mkdir(path.dirname(workflowFilePath), { recursive: true });
    this.lastInternalWorkflowWritePath = normalizePathForCompare(workflowFilePath);
    this.lastInternalWorkflowWriteAt = Date.now();
    await fs.writeFile(workflowFilePath, JSON.stringify(savedWorkflow, null, 2), 'utf-8');

    return savedWorkflow;
  }

  private async startWatcher(
    workspacePath: string,
    sender: Electron.WebContents
  ): Promise<void> {
    await this.closeWatcher();

    this.currentWorkspacePath = workspacePath;
    this.currentSender = sender;
    this.watcher = watch(workspacePath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 250,
        pollInterval: 100,
      },
      ignored: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.fluxion/memory/**',
        '**/out/**',
        '**/dist/**',
      ],
    });

    this.watcher.on('all', (eventName: string, changedPath: string) => {
      const currentSender = this.currentSender;
      const currentWorkspacePath = this.currentWorkspacePath;
      if (!currentSender || !currentWorkspacePath) {
        return;
      }

      if (eventName !== 'add' && eventName !== 'change' && eventName !== 'unlink') {
        return;
      }

      const filePath = path.resolve(changedPath);
      
      // We only suppress external change events if the file changing is the 
      // one we JUST wrote to internally. 
      if (this.shouldIgnoreInternalWorkflowWrite(filePath)) {
        return;
      }

      // If the file changing is the active workflow file, tell the frontend
      // so it can show the "External change detected" banner
      const relativePath = this.toRelativePath(currentWorkspacePath, filePath);
      if (!relativePath) {
        return;
      }

      // Check if it's the active workflow
      const isActiveWorkflow = this.activeWorkflowFilePath && 
                               normalizePathForCompare(filePath) === normalizePathForCompare(this.activeWorkflowFilePath);

      currentSender.send(IpcChannels.WORKSPACE_FILE_CHANGED, {
        filePath,
        relativePath,
        changeType: eventName as SupportedChangeType,
        // Optional: frontend can use this to know if it should prompt reload
        isActiveWorkflow 
      } as WorkspaceFileChangedPayload & { isActiveWorkflow?: boolean });
    });

    this.watcher.on('error', (error: unknown) => {
      console.error('Workspace watcher error:', error);
    });
  }

  private shouldIgnoreInternalWorkflowWrite(filePath: string): boolean {
    if (!this.lastInternalWorkflowWritePath) {
      return false;
    }

    return (
      normalizePathForCompare(filePath) === this.lastInternalWorkflowWritePath &&
      Date.now() - this.lastInternalWorkflowWriteAt < 1500
    );
  }

  private toRelativePath(workspacePath: string, filePath: string): string {
    const relativePath = path.relative(workspacePath, filePath);
    return relativePath.replaceAll('\\', '/');
  }

  private async closeWatcher(): Promise<void> {
    if (!this.watcher) {
      return;
    }

    await this.watcher.close();
    this.watcher = null;
  }
}

export const workspaceService = WorkspaceService.getInstance();
