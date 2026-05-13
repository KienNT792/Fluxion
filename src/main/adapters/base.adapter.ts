import { AgentChunk, AgentResult, AbortReason, AgentNodeData, AgentTextChunk, NodeId } from '@shared';

export interface IAgentAdapter {
  /**
   * Executes the agent with the given node configuration and compiled prompt.
   * @param nodeId     Unique identifier of the executing node.
   * @param nodeData   Full node configuration (provider, model, temperature, etc.).
   * @param prompt     The compiled mega-prompt (global context + user instruction).
   * @param workspacePath  Absolute path to the workspace root.
   */
  execute(nodeId: NodeId, nodeData: AgentNodeData, prompt: string, workspacePath: string): AsyncGenerator<AgentChunk, AgentResult, void>;
  
  /**
   * Aborts the execution of this agent if it's currently running.
   */
  abort(nodeId: NodeId, reason: AbortReason): Promise<void>;
}

export abstract class BaseAdapter implements IAgentAdapter {
  protected activeExecutions: Set<NodeId> = new Set();

  public abstract execute(nodeId: NodeId, nodeData: AgentNodeData, prompt: string, workspacePath: string): AsyncGenerator<AgentChunk, AgentResult, void>;

  public async abort(nodeId: NodeId, reason: AbortReason): Promise<void> {
    if (this.activeExecutions.has(nodeId)) {
      this.activeExecutions.delete(nodeId);
      await this.onAbort(nodeId, reason);
    }
  }

  /**
   * Called when abort is triggered. Derived classes should implement specific cleanup
   * (e.g. killing the process manager child process or cancelling an API request).
   */
  protected abstract onAbort(nodeId: NodeId, reason: AbortReason): Promise<void>;

  /**
   * Helper to create a standard chunk.
   */
  protected createChunk(type: AgentTextChunk['type'], content: string): AgentTextChunk {
    return {
      type,
      content,
      timestamp: Date.now()
    };
  }
}
