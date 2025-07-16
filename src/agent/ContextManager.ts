import type { ContextMessage, ToolCall, ToolResult } from '../types/index.js';

/**
 * Manages the 30,000 token context window for long-term coherence
 */
export class ContextManager {
  private messages: ContextMessage[];
  private maxTokens: number;
  private currentTokenCount: number;
  private tokenBuffer: number; // Reserve tokens for system prompt and tools

  constructor(maxTokens: number = 30000, tokenBuffer: number = 2000) {
    this.messages = [];
    this.maxTokens = maxTokens;
    this.tokenBuffer = tokenBuffer;
    this.currentTokenCount = 0;
  }

  /**
   * Estimates token count for text (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    // More accurate estimation considering:
    // - Average English word is ~4.5 characters
    // - GPT tokenization is roughly 1 token per 4 characters
    // - JSON structure adds overhead
    const baseTokens = Math.ceil(text.length / 4);
    
    // Add overhead for JSON structure, special tokens, etc.
    const overhead = Math.ceil(baseTokens * 0.1);
    
    return baseTokens + overhead;
  }

  /**
   * Estimates tokens for a complete message including metadata
   */
  private estimateMessageTokens(message: ContextMessage): number {
    let tokens = this.estimateTokens(message.content);
    
    // Add tokens for role and metadata
    tokens += 10; // Base overhead for message structure
    
    // Add tokens for tool calls if present
    if (message.toolCalls) {
      for (const toolCall of message.toolCalls) {
        // Tool calls have additional overhead due to structured format
        const toolCallStr = JSON.stringify(toolCall);
        tokens += this.estimateTokens(toolCallStr) + 5; // Extra tokens for structure
      }
    }
    
    // Add tokens for tool results if present
    if (message.toolResults) {
      for (const result of message.toolResults) {
        tokens += this.estimateTokens(JSON.stringify(result));
      }
    }
    
    return tokens;
  }

  /**
   * Adds a message to the context window
   */
  public addMessage(
    role: ContextMessage['role'],
    content: string,
    toolCalls?: ToolCall[],
    toolResults?: ToolResult[]
  ): void {
    const message: ContextMessage = {
      role,
      content,
      toolCalls,
      toolResults,
      timestamp: new Date(),
      tokens: 0, // Will be calculated below
    };

    message.tokens = this.estimateMessageTokens(message);
    
    this.messages.push(message);
    this.currentTokenCount += message.tokens;
    
    // Prune if necessary
    this.pruneOldMessages();
  }

  /**
   * Adds a system message
   */
  public addSystemMessage(content: string): void {
    this.addMessage('system', content);
  }

  /**
   * Adds a user message
   */
  public addUserMessage(content: string): void {
    this.addMessage('user', content);
  }

  /**
   * Adds an assistant message
   */
  public addAssistantMessage(content: string, toolCalls?: ToolCall[]): void {
    this.addMessage('assistant', content, toolCalls);
  }

  /**
   * Adds a tool result message
   */
  public addToolMessage(content: string, toolResults?: ToolResult[]): void {
    this.addMessage('tool', content, undefined, toolResults);
  }

  /**
   * Prunes old messages when context window is full
   */
  public pruneOldMessages(): void {
    const availableTokens = this.maxTokens - this.tokenBuffer;
    
    if (this.currentTokenCount <= availableTokens) {
      return;
    }

    // Strategy: Keep most recent messages and important system messages
    const importantMessages: ContextMessage[] = [];
    const regularMessages: ContextMessage[] = [];
    
    for (const message of this.messages) {
      if (this.isImportantMessage(message)) {
        importantMessages.push(message);
      } else {
        regularMessages.push(message);
      }
    }
    
    // Always keep important messages
    let keptMessages = [...importantMessages];
    let tokenCount = importantMessages.reduce((sum, msg) => sum + msg.tokens, 0);
    
    // Add regular messages from most recent, working backwards
    for (let i = regularMessages.length - 1; i >= 0; i--) {
      const message = regularMessages[i];
      if (tokenCount + message.tokens <= availableTokens) {
        keptMessages.unshift(message);
        tokenCount += message.tokens;
      } else {
        break;
      }
    }
    
    // Sort by timestamp to maintain chronological order
    keptMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    this.messages = keptMessages;
    this.currentTokenCount = tokenCount;
  }

  /**
   * Determines if a message is important and should be preserved
   */
  private isImportantMessage(message: ContextMessage): boolean {
    // System messages are always important
    if (message.role === 'system') {
      return true;
    }
    
    // Messages with tool calls are important for context
    if (message.toolCalls && message.toolCalls.length > 0) {
      return true;
    }
    
    // Recent messages (last hour) are important
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    if (message.timestamp > oneHourAgo) {
      return true;
    }
    
    // Messages containing key decision words
    const importantKeywords = [
      'decision', 'bankrupt', 'error', 'kill campaign', 'scale',
      'product launch', 'critical', 'important', 'urgent'
    ];
    
    const content = message.content.toLowerCase();
    return importantKeywords.some(keyword => content.includes(keyword));
  }

  /**
   * Gets recent context messages for AI consumption
   */
  public getRecentContext(limit?: number): ContextMessage[] {
    const messages = limit ? this.messages.slice(-limit) : this.messages;
    
    // Convert to format expected by AI APIs
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      toolResults: msg.toolResults,
      timestamp: msg.timestamp,
      tokens: msg.tokens,
    }));
  }

  /**
   * Gets messages formatted for Grok-4 API
   */
  public getMessagesForGrok(): Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
  }> {
    return this.messages.map(msg => {
      const grokMessage: any = {
        role: msg.role,
        content: msg.content,
      };
      
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        grokMessage.tool_calls = msg.toolCalls;
      }
      
      return grokMessage;
    });
  }

  /**
   * Summarizes older messages to preserve context while reducing tokens
   */
  public async summarizeOldMessages(keepRecentCount: number = 10): Promise<void> {
    if (this.messages.length <= keepRecentCount) {
      return;
    }
    
    const recentMessages = this.messages.slice(-keepRecentCount);
    const oldMessages = this.messages.slice(0, -keepRecentCount);
    
    if (oldMessages.length === 0) {
      return;
    }
    
    // Create summary of old messages
    const summary = this.createMessageSummary(oldMessages);
    
    // Replace old messages with summary
    const summaryMessage: ContextMessage = {
      role: 'system',
      content: `Context Summary: ${summary}`,
      timestamp: new Date(),
      tokens: this.estimateTokens(summary),
    };
    
    this.messages = [summaryMessage, ...recentMessages];
    this.recalculateTokenCount();
  }

  /**
   * Creates a summary of multiple messages
   */
  private createMessageSummary(messages: ContextMessage[]): string {
    const summaryParts: string[] = [];
    
    // Group messages by type
    const decisions = messages.filter(m => m.content.toLowerCase().includes('decision'));
    const errors = messages.filter(m => m.content.toLowerCase().includes('error'));
    const metrics = messages.filter(m => m.content.toLowerCase().includes('roas') || m.content.toLowerCase().includes('revenue'));
    const actions = messages.filter(m => m.toolCalls && m.toolCalls.length > 0);
    
    if (decisions.length > 0) {
      summaryParts.push(`Made ${decisions.length} key decisions`);
    }
    
    if (errors.length > 0) {
      summaryParts.push(`Encountered ${errors.length} errors`);
    }
    
    if (metrics.length > 0) {
      summaryParts.push(`Tracked ${metrics.length} performance metrics`);
    }
    
    if (actions.length > 0) {
      const toolCounts: Record<string, number> = {};
      actions.forEach(msg => {
        msg.toolCalls?.forEach(call => {
          toolCounts[call.name] = (toolCounts[call.name] || 0) + 1;
        });
      });
      
      const toolSummary = Object.entries(toolCounts)
        .map(([tool, count]) => `${tool}(${count})`)
        .join(', ');
      
      summaryParts.push(`Executed tools: ${toolSummary}`);
    }
    
    const timeRange = messages.length > 0 
      ? `from ${messages[0].timestamp.toISOString()} to ${messages[messages.length - 1].timestamp.toISOString()}`
      : '';
    
    return `Previous context ${timeRange}: ${summaryParts.join('; ')}.`;
  }

  /**
   * Recalculates total token count
   */
  private recalculateTokenCount(): void {
    this.currentTokenCount = this.messages.reduce((sum, msg) => sum + msg.tokens, 0);
  }

  /**
   * Gets context window statistics
   */
  public getStats(): {
    messageCount: number;
    tokenCount: number;
    maxTokens: number;
    utilizationPercent: number;
    availableTokens: number;
    oldestMessage: Date | null;
    newestMessage: Date | null;
    messagesByRole: Record<string, number>;
  } {
    const messagesByRole: Record<string, number> = {};
    
    for (const message of this.messages) {
      messagesByRole[message.role] = (messagesByRole[message.role] || 0) + 1;
    }
    
    const availableTokens = this.maxTokens - this.tokenBuffer - this.currentTokenCount;
    
    return {
      messageCount: this.messages.length,
      tokenCount: this.currentTokenCount,
      maxTokens: this.maxTokens,
      utilizationPercent: (this.currentTokenCount / (this.maxTokens - this.tokenBuffer)) * 100,
      availableTokens: Math.max(0, availableTokens),
      oldestMessage: this.messages.length > 0 ? this.messages[0].timestamp : null,
      newestMessage: this.messages.length > 0 ? this.messages[this.messages.length - 1].timestamp : null,
      messagesByRole,
    };
  }

  /**
   * Checks if context window is near capacity
   */
  public isNearCapacity(threshold: number = 0.8): boolean {
    const stats = this.getStats();
    return stats.utilizationPercent >= threshold * 100;
  }

  /**
   * Gets messages within a specific time range
   */
  public getMessagesByTimeRange(startTime: Date, endTime: Date): ContextMessage[] {
    return this.messages.filter(
      msg => msg.timestamp >= startTime && msg.timestamp <= endTime
    );
  }

  /**
   * Gets messages by role
   */
  public getMessagesByRole(role: ContextMessage['role']): ContextMessage[] {
    return this.messages.filter(msg => msg.role === role);
  }

  /**
   * Searches messages by content
   */
  public searchMessages(query: string, caseSensitive: boolean = false): ContextMessage[] {
    const searchQuery = caseSensitive ? query : query.toLowerCase();
    
    return this.messages.filter(msg => {
      const content = caseSensitive ? msg.content : msg.content.toLowerCase();
      return content.includes(searchQuery);
    });
  }

  /**
   * Gets the last N messages
   */
  public getLastMessages(count: number): ContextMessage[] {
    return this.messages.slice(-count);
  }

  /**
   * Clears all messages
   */
  public clear(): void {
    this.messages = [];
    this.currentTokenCount = 0;
  }

  /**
   * Exports context data
   */
  public export(): {
    messages: ContextMessage[];
    maxTokens: number;
    tokenBuffer: number;
    currentTokenCount: number;
    exportedAt: Date;
  } {
    return {
      messages: [...this.messages],
      maxTokens: this.maxTokens,
      tokenBuffer: this.tokenBuffer,
      currentTokenCount: this.currentTokenCount,
      exportedAt: new Date(),
    };
  }

  /**
   * Imports context data
   */
  public import(data: {
    messages: ContextMessage[];
    maxTokens?: number;
    tokenBuffer?: number;
  }): void {
    this.messages = [...data.messages];
    
    if (data.maxTokens) {
      this.maxTokens = data.maxTokens;
    }
    
    if (data.tokenBuffer) {
      this.tokenBuffer = data.tokenBuffer;
    }
    
    this.recalculateTokenCount();
  }

  /**
   * Optimizes context by removing redundant messages
   */
  public optimize(): number {
    const initialCount = this.messages.length;
    
    // Remove duplicate consecutive messages with same content
    const optimizedMessages: ContextMessage[] = [];
    
    for (let i = 0; i < this.messages.length; i++) {
      const current = this.messages[i];
      const previous = optimizedMessages[optimizedMessages.length - 1];
      
      // Skip if identical to previous message (except timestamp)
      if (previous && 
          previous.role === current.role && 
          previous.content === current.content &&
          JSON.stringify(previous.toolCalls) === JSON.stringify(current.toolCalls)) {
        continue;
      }
      
      optimizedMessages.push(current);
    }
    
    this.messages = optimizedMessages;
    this.recalculateTokenCount();
    
    return initialCount - this.messages.length;
  }
}