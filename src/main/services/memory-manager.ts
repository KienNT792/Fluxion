import * as fs from 'fs/promises';
import * as path from 'path';
import matter from 'gray-matter';
import { NodeId } from '../../shared/workflow.types';
import { FrontmatterMetadata } from '../../shared/memory.types';

export class MemoryManager {
  private static instance: MemoryManager;

  private constructor() {
    // Singleton
  }

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * Initializes the tiered memory directories in the workspace.
   */
  public async initWorkspace(workspacePath: string): Promise<void> {
    const memoryDir = path.join(workspacePath, '.fluxion', 'memory');
    const shortTermDir = path.join(memoryDir, 'short-term');
    const longTermDir = path.join(memoryDir, 'long-term');

    await fs.mkdir(shortTermDir, { recursive: true });
    await fs.mkdir(longTermDir, { recursive: true });

    // Initialize global-context.md if it doesn't exist
    const globalContextPath = path.join(memoryDir, 'global-context.md');
    try {
      await fs.access(globalContextPath);
    } catch {
      const defaultGlobalContext = matter.stringify(
        '# Global Workspace Rules\n\nAdd your system rules here.',
        { type: 'global', version: '1.0' }
      );
      await fs.writeFile(globalContextPath, defaultGlobalContext, 'utf-8');
    }
  }

  /**
   * Injects the context for a specific node execution.
   * Compiles Global Context + Short-term Context + Long-term Context.
   */
  public async compileContext(
    workspacePath: string,
    workflowId: string,
    previousNodeIds: NodeId[]
  ): Promise<string> {
    const memoryDir = path.join(workspacePath, '.fluxion', 'memory');
    
    // 1. Read Global Context
    let context = '';
    try {
      const globalContent = await fs.readFile(path.join(memoryDir, 'global-context.md'), 'utf-8');
      const parsedGlobal = matter(globalContent);
      context += `[GLOBAL CONTEXT]\n${parsedGlobal.content}\n\n`;
    } catch (e) {
      console.warn('Could not read global context', e);
    }

    // 2. Read Short-term Context from previous nodes
    if (previousNodeIds.length > 0) {
      context += `[SHORT-TERM CONTEXT]\n`;
      for (const nodeId of previousNodeIds) {
        try {
          const nodePath = path.join(memoryDir, 'short-term', workflowId, `${nodeId}.md`);
          const nodeContent = await fs.readFile(nodePath, 'utf-8');
          const parsedNode = matter(nodeContent);
          const provider = typeof parsedNode.data.provider === 'string' ? parsedNode.data.provider : 'Unknown';
          const model = typeof parsedNode.data.model === 'string' ? parsedNode.data.model : '';
          const sourceLabel = model ? `${provider} / ${model}` : provider;

          context += `--- Output from Node ${nodeId} (${sourceLabel}) ---\n`;
          context += `${parsedNode.content}\n\n`;
        } catch (e) {
          console.warn(`Could not read short-term context for node ${nodeId}`, e);
        }
      }
    }

    // 3. Read Long-term Context (Summarized history)
    try {
      const longTermIndex = await fs.readFile(path.join(memoryDir, 'long-term', 'index.md'), 'utf-8');
      context += `[LONG-TERM CONTEXT]\n${longTermIndex}\n\n`;
    } catch {
      // It's ok if long-term index doesn't exist yet
    }

    return context;
  }

  /**
   * Saves the output of a node execution to the short-term memory.
   */
  public async saveNodeOutput(
    workspacePath: string,
    workflowId: string,
    nodeId: NodeId,
    provider: FrontmatterMetadata['provider'],
    model: FrontmatterMetadata['model'],
    content: string,
    status: FrontmatterMetadata['status'] = 'completed'
  ): Promise<void> {
    const memoryDir = path.join(workspacePath, '.fluxion', 'memory', 'short-term', workflowId);
    
    // Ensure directory exists
    await fs.mkdir(memoryDir, { recursive: true });

    const mdContent = matter.stringify(content, {
      schemaVersion: '1.0',
      nodeId,
      provider,
      model,
      timestamp: Date.now(),
      status
    });

    await fs.writeFile(path.join(memoryDir, `${nodeId}.md`), mdContent, 'utf-8');
  }
}

export const memoryManager = MemoryManager.getInstance();
