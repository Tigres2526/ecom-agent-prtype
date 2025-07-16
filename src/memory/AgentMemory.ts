import type { MemoryEntry, MemorySearchResult } from '../types/index.js';
import { MemoryStore } from './MemoryStore.js';
import { VectorSearch } from './VectorSearch.js';

/**
 * Unified memory system combining scratchpad, key-value, and vector search
 */
export class AgentMemory {
  private memoryStore: MemoryStore;
  private vectorSearch: VectorSearch;
  private currentDay: number;
  private errorCounter: number;

  constructor(
    maxMemoryEntries: number = 10000,
    maxVectorEntries: number = 5000
  ) {
    this.memoryStore = new MemoryStore(maxMemoryEntries);
    this.vectorSearch = new VectorSearch(maxVectorEntries);
    this.currentDay = 0;
    this.errorCounter = 0;
  }

  /**
   * Updates the current day for memory operations
   */
  public setCurrentDay(day: number): void {
    this.currentDay = day;
  }

  /**
   * Writes to scratchpad memory (recent decisions and context)
   */
  public async writeScratchpad(key: string, value: string, type: MemoryEntry['type'] = 'decision'): Promise<void> {
    this.memoryStore.writeScratchpad(key, value, this.currentDay, type);
    
    // Also store in vector database for semantic search
    const entry: MemoryEntry = {
      key,
      value,
      timestamp: new Date(),
      day: this.currentDay,
      type,
    };
    
    await this.vectorSearch.storeVector(entry);
  }

  /**
   * Writes to key-value store (structured persistent data)
   */
  public async writeKeyValue(key: string, value: string, type: MemoryEntry['type'] = 'metric'): Promise<void> {
    this.memoryStore.writeKeyValue(key, value, this.currentDay, type);
    
    // Store important insights in vector database
    if (type === 'insight' || type === 'decision') {
      const entry: MemoryEntry = {
        key,
        value,
        timestamp: new Date(),
        day: this.currentDay,
        type,
      };
      
      await this.vectorSearch.storeVector(entry);
    }
  }

  /**
   * Generic write method that chooses appropriate storage
   */
  public async write(key: string, value: string, type: MemoryEntry['type'] = 'decision'): Promise<void> {
    if (type === 'decision' || type === 'error') {
      await this.writeScratchpad(key, value, type);
    } else {
      await this.writeKeyValue(key, value, type);
    }
  }

  /**
   * Reads from memory (checks both stores)
   */
  public read(key: string): MemoryEntry | null {
    return this.memoryStore.read(key);
  }

  /**
   * Gets recent scratchpad entries
   */
  public getRecentContext(limit: number = 50): MemoryEntry[] {
    return this.memoryStore.getRecentScratchpad(limit);
  }

  /**
   * Gets entries by type
   */
  public getEntriesByType(type: MemoryEntry['type']): MemoryEntry[] {
    return this.memoryStore.getEntriesByType(type);
  }

  /**
   * Gets entries from a specific day range
   */
  public getEntriesByDayRange(startDay: number, endDay: number): MemoryEntry[] {
    return this.memoryStore.getEntriesByDayRange(startDay, endDay);
  }

  /**
   * Searches memory using semantic similarity
   */
  public async searchVector(query: string, limit: number = 5, minSimilarity: number = 0.7): Promise<MemorySearchResult[]> {
    return await this.vectorSearch.searchSimilar(query, limit, minSimilarity);
  }

  /**
   * Searches recent memories with semantic similarity
   */
  public async searchRecent(query: string, days: number = 7, limit: number = 5): Promise<MemorySearchResult[]> {
    return await this.vectorSearch.searchRecent(query, days, limit);
  }

  /**
   * Searches by type with semantic similarity
   */
  public async searchByType(query: string, type: MemoryEntry['type'], limit: number = 5): Promise<MemorySearchResult[]> {
    return await this.vectorSearch.searchByType(query, type, limit);
  }

  /**
   * Finds similar entries to a given entry
   */
  public async findSimilar(entry: MemoryEntry, limit: number = 5): Promise<MemorySearchResult[]> {
    return await this.vectorSearch.findSimilarEntries(entry, limit);
  }

  /**
   * Searches memory using simple text matching
   */
  public searchByKeyword(keyword: string): MemoryEntry[] {
    const keyResults = this.memoryStore.searchByKey(keyword);
    const valueResults = this.memoryStore.searchByValue(keyword);
    
    // Combine and deduplicate results
    const allResults = [...keyResults, ...valueResults];
    const uniqueResults = allResults.filter((entry, index, array) => 
      array.findIndex(e => e.key === entry.key) === index
    );
    
    return uniqueResults;
  }

  /**
   * Logs a decision with context
   */
  public async logDecision(
    decision: string,
    reasoning: string,
    context: string,
    expectedOutcome: string,
    confidence: number
  ): Promise<void> {
    const key = `decision_day_${this.currentDay}_${Date.now()}`;
    const value = JSON.stringify({
      decision,
      reasoning,
      context,
      expectedOutcome,
      confidence,
      timestamp: new Date().toISOString(),
    });
    
    await this.writeScratchpad(key, value, 'decision');
  }

  /**
   * Logs an insight or learning
   */
  public async logInsight(insight: string, category: string = 'general'): Promise<void> {
    const key = `insight_${category}_day_${this.currentDay}_${Date.now()}`;
    const value = JSON.stringify({
      insight,
      category,
      day: this.currentDay,
      timestamp: new Date().toISOString(),
    });
    
    await this.writeKeyValue(key, value, 'insight');
  }

  /**
   * Logs a metric or measurement
   */
  public async logMetric(name: string, value: number, metadata?: Record<string, any>): Promise<void> {
    const key = `metric_${name}_day_${this.currentDay}`;
    const metricValue = JSON.stringify({
      name,
      value,
      day: this.currentDay,
      metadata,
      timestamp: new Date().toISOString(),
    });
    
    await this.writeKeyValue(key, metricValue, 'metric');
  }

  /**
   * Logs an error with context
   */
  public async logError(error: string, context: Record<string, any>): Promise<void> {
    const key = `error_day_${this.currentDay}_${Date.now()}_${++this.errorCounter}`;
    const value = JSON.stringify({
      error,
      context,
      day: this.currentDay,
      timestamp: new Date().toISOString(),
    });
    
    await this.writeScratchpad(key, value, 'error');
  }

  /**
   * Gets decision history for analysis
   */
  public getDecisionHistory(days: number = 7): MemoryEntry[] {
    const startDay = Math.max(0, this.currentDay - days);
    return this.getEntriesByDayRange(startDay, this.currentDay)
      .filter(entry => entry.type === 'decision')
      .sort((a, b) => b.day - a.day);
  }

  /**
   * Gets recent insights
   */
  public getRecentInsights(limit: number = 10): MemoryEntry[] {
    return this.getEntriesByType('insight')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Gets error patterns
   */
  public getErrorPatterns(days: number = 7): { error: string; count: number; lastOccurrence: Date }[] {
    const startDay = Math.max(0, this.currentDay - days);
    const errors = this.getEntriesByDayRange(startDay, this.currentDay)
      .filter(entry => entry.type === 'error');
    
    const errorCounts: Record<string, { count: number; lastOccurrence: Date }> = {};
    
    for (const error of errors) {
      try {
        const errorData = JSON.parse(error.value);
        const errorType = errorData.error || 'unknown';
        
        if (!errorCounts[errorType]) {
          errorCounts[errorType] = { count: 0, lastOccurrence: error.timestamp };
        }
        
        errorCounts[errorType].count++;
        if (error.timestamp > errorCounts[errorType].lastOccurrence) {
          errorCounts[errorType].lastOccurrence = error.timestamp;
        }
      } catch {
        // Skip malformed error entries
      }
    }
    
    return Object.entries(errorCounts).map(([error, data]) => ({
      error,
      count: data.count,
      lastOccurrence: data.lastOccurrence,
    }));
  }

  /**
   * Prunes old memories to prevent overflow
   */
  public async pruneOldMemories(daysToKeep: number = 30): Promise<{ memoryPruned: number; vectorsPruned: number }> {
    const memoryPruned = this.memoryStore.pruneOldEntries(daysToKeep);
    const vectorsPruned = this.vectorSearch.pruneOldVectors(daysToKeep);
    
    return { memoryPruned, vectorsPruned };
  }

  /**
   * Gets comprehensive memory statistics
   */
  public getMemoryStats(): {
    memory: ReturnType<MemoryStore['getStats']>;
    vectors: ReturnType<VectorSearch['getVectorStats']>;
    summary: {
      totalEntries: number;
      recentDecisions: number;
      insights: number;
      errors: number;
      metrics: number;
    };
  } {
    const memoryStats = this.memoryStore.getStats();
    const vectorStats = this.vectorSearch.getVectorStats();
    
    const allEntries = this.memoryStore.getAllEntries();
    const recentDecisions = allEntries.filter(
      e => e.type === 'decision' && e.day >= this.currentDay - 7
    ).length;
    
    const insights = allEntries.filter(e => e.type === 'insight').length;
    const errors = allEntries.filter(e => e.type === 'error').length;
    const metrics = allEntries.filter(e => e.type === 'metric').length;
    
    return {
      memory: memoryStats,
      vectors: vectorStats,
      summary: {
        totalEntries: allEntries.length,
        recentDecisions,
        insights,
        errors,
        metrics,
      },
    };
  }

  /**
   * Clears all memory (use with caution)
   */
  public clearAll(): void {
    this.memoryStore.clear();
    this.vectorSearch.clearVectors();
  }

  /**
   * Exports all memory data
   */
  public exportMemory(): {
    memory: ReturnType<MemoryStore['export']>;
    vectors: ReturnType<VectorSearch['exportVectors']>;
    currentDay: number;
  } {
    return {
      memory: this.memoryStore.export(),
      vectors: this.vectorSearch.exportVectors(),
      currentDay: this.currentDay,
    };
  }

  /**
   * Imports memory data
   */
  public async importMemory(data: {
    memory: { scratchpad: MemoryEntry[]; keyValue: MemoryEntry[] };
    vectors: Array<MemoryEntry & { embedding: number[] }>;
    currentDay: number;
  }): Promise<void> {
    this.memoryStore.import(data.memory);
    this.vectorSearch.importVectors(data.vectors);
    this.currentDay = data.currentDay;
  }
}