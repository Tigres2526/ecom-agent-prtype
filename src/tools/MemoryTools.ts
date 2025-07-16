import type { ToolResult } from '../types/index.js';
import type { AgentMemory } from '../memory/AgentMemory.js';
import type { AgentState } from '../models/AgentState.js';

/**
 * Memory management tools for the dropshipping agent
 */
export class MemoryTools {
  private memory: AgentMemory;
  private agentState: AgentState;

  constructor(memory: AgentMemory, agentState: AgentState) {
    this.memory = memory;
    this.agentState = agentState;
  }

  /**
   * Store important information in long-term memory
   */
  public async remember(
    key: string,
    value: any,
    category: 'decision' | 'metric' | 'insight' | 'error'
  ): Promise<ToolResult> {
    try {
      // Store in key-value memory
      await this.memory.writeKeyValue(key, JSON.stringify(value), 'metric');
      
      // Also write to scratchpad for immediate context
      await this.memory.writeScratchpad(
        key,
        JSON.stringify(value),
        category
      );
      
      // Store in general memory for vector search
      const content = typeof value === 'string' ? value : JSON.stringify(value);
      await this.memory.write(
        `${category}_${key}`,
        content,
        category
      );
      
      return {
        success: true,
        data: {
          key,
          category,
          stored: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to store memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Retrieve information from long-term memory
   */
  public async recall(
    query: string,
    category?: 'decision' | 'metric' | 'insight' | 'error',
    limit: number = 5
  ): Promise<ToolResult> {
    try {
      // First, try exact key match
      const exactMatch = this.memory.read(query);
      
      // Then search vector memory for semantic matches
      const semanticMatches = await this.memory.searchVector(query, limit);
      
      // Filter by category if specified
      const filteredMatches = category
        ? semanticMatches.filter((match: any) => match.metadata?.category === category)
        : semanticMatches;
      
      // Get recent entries
      const recentNotes = this.memory.getRecentContext(limit);
      const categoryNotes = category
        ? recentNotes.filter((note: any) => note.type === category)
        : recentNotes;
      
      return {
        success: true,
        data: {
          exactMatch: exactMatch || null,
          semanticMatches: filteredMatches.map((match: any) => ({
            content: match.content,
            similarity: match.similarity,
            metadata: match.metadata,
          })),
          recentNotes: categoryNotes.map((note: any) => ({
            key: note.key,
            content: note.value,
            day: note.day,
            category: note.type,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to recall memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Write temporary notes to scratchpad
   */
  public async writeScratchpad(note: string, category?: string): Promise<ToolResult> {
    try {
      const key = `note_${Date.now()}`;
      await this.memory.writeScratchpad(
        key,
        note,
        'insight'
      );
      
      return {
        success: true,
        data: {
          key,
          note,
          day: this.agentState.currentDay,
          category: category || 'general',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write to scratchpad: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Search for past decisions and their outcomes
   */
  public async searchDecisions(query: string, limit: number = 10): Promise<ToolResult> {
    try {
      // Search for decisions in vector memory
      const decisions = await this.memory.searchVector(query, limit * 2);
      
      // Filter for decision-related entries
      const decisionEntries = decisions
        .filter((match: any) => 
          match.metadata?.category === 'decision' ||
          match.content.toLowerCase().includes('decision') ||
          match.content.toLowerCase().includes('decided')
        )
        .slice(0, limit);
      
      return {
        success: true,
        data: {
          decisions: decisionEntries.map((entry: any) => ({
            content: entry.content,
            similarity: entry.similarity,
            day: entry.metadata?.day,
            timestamp: entry.metadata?.timestamp,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to search decisions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get memory usage statistics
   */
  public async getMemoryStats(): Promise<ToolResult> {
    try {
      const recentEntries = this.memory.getRecentContext(1000);
      const scratchpadEntries = recentEntries.length;
      const totalDays = this.agentState.currentDay;
      
      // Get unique categories from entries
      const categories = new Set(
        recentEntries.map((entry: any) => entry.type)
      );
      
      return {
        success: true,
        data: {
          scratchpadEntries,
          totalDays,
          categoriesUsed: Array.from(categories),
          currentDay: this.agentState.currentDay,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get memory stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}