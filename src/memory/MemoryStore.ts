import type { MemoryEntry, MemorySearchResult } from '../types/index.js';

/**
 * Basic memory store for scratchpad and key-value storage
 */
export class MemoryStore {
  private scratchpad: Map<string, MemoryEntry>;
  private keyValueStore: Map<string, MemoryEntry>;
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.scratchpad = new Map();
    this.keyValueStore = new Map();
    this.maxEntries = maxEntries;
  }

  /**
   * Writes to scratchpad memory (temporary, recent decisions)
   */
  public writeScratchpad(key: string, value: string, day: number, type: MemoryEntry['type'] = 'decision'): void {
    const entry: MemoryEntry = {
      key,
      value,
      timestamp: new Date(),
      day,
      type,
    };

    this.scratchpad.set(key, entry);
    this.enforceMemoryLimits();
  }

  /**
   * Writes to key-value store (structured, persistent data)
   */
  public writeKeyValue(key: string, value: string, day: number, type: MemoryEntry['type'] = 'metric'): void {
    const entry: MemoryEntry = {
      key,
      value,
      timestamp: new Date(),
      day,
      type,
    };

    this.keyValueStore.set(key, entry);
    this.enforceMemoryLimits();
  }

  /**
   * Reads from scratchpad memory
   */
  public readScratchpad(key: string): MemoryEntry | null {
    return this.scratchpad.get(key) || null;
  }

  /**
   * Reads from key-value store
   */
  public readKeyValue(key: string): MemoryEntry | null {
    return this.keyValueStore.get(key) || null;
  }

  /**
   * Reads from both stores (scratchpad first, then key-value)
   */
  public read(key: string): MemoryEntry | null {
    return this.readScratchpad(key) || this.readKeyValue(key);
  }

  /**
   * Gets all scratchpad entries
   */
  public getAllScratchpad(): MemoryEntry[] {
    return Array.from(this.scratchpad.values());
  }

  /**
   * Gets all key-value entries
   */
  public getAllKeyValue(): MemoryEntry[] {
    return Array.from(this.keyValueStore.values());
  }

  /**
   * Gets all entries from both stores
   */
  public getAllEntries(): MemoryEntry[] {
    return [...this.getAllScratchpad(), ...this.getAllKeyValue()];
  }

  /**
   * Gets recent entries from scratchpad (last N entries)
   */
  public getRecentScratchpad(limit: number = 50): MemoryEntry[] {
    const entries = this.getAllScratchpad();
    return entries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Gets entries by type
   */
  public getEntriesByType(type: MemoryEntry['type']): MemoryEntry[] {
    return this.getAllEntries().filter(entry => entry.type === type);
  }

  /**
   * Gets entries by day range
   */
  public getEntriesByDayRange(startDay: number, endDay: number): MemoryEntry[] {
    return this.getAllEntries().filter(
      entry => entry.day >= startDay && entry.day <= endDay
    );
  }

  /**
   * Searches entries by key pattern (simple string matching)
   */
  public searchByKey(pattern: string): MemoryEntry[] {
    const regex = new RegExp(pattern, 'i');
    return this.getAllEntries().filter(entry => regex.test(entry.key));
  }

  /**
   * Searches entries by value content (simple string matching)
   */
  public searchByValue(query: string): MemoryEntry[] {
    const regex = new RegExp(query, 'i');
    return this.getAllEntries().filter(entry => regex.test(entry.value));
  }

  /**
   * Deletes entry from scratchpad
   */
  public deleteScratchpad(key: string): boolean {
    return this.scratchpad.delete(key);
  }

  /**
   * Deletes entry from key-value store
   */
  public deleteKeyValue(key: string): boolean {
    return this.keyValueStore.delete(key);
  }

  /**
   * Deletes entry from both stores
   */
  public delete(key: string): boolean {
    const scratchpadDeleted = this.deleteScratchpad(key);
    const keyValueDeleted = this.deleteKeyValue(key);
    return scratchpadDeleted || keyValueDeleted;
  }

  /**
   * Prunes old entries (older than specified days)
   */
  public pruneOldEntries(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let prunedCount = 0;

    // Prune scratchpad
    for (const [key, entry] of this.scratchpad.entries()) {
      if (entry.timestamp < cutoffDate) {
        this.scratchpad.delete(key);
        prunedCount++;
      }
    }

    // Prune key-value store (but keep important metrics)
    for (const [key, entry] of this.keyValueStore.entries()) {
      if (entry.timestamp < cutoffDate && entry.type !== 'metric') {
        this.keyValueStore.delete(key);
        prunedCount++;
      }
    }

    return prunedCount;
  }

  /**
   * Enforces memory limits by removing oldest entries
   */
  private enforceMemoryLimits(): void {
    const totalEntries = this.scratchpad.size + this.keyValueStore.size;
    
    if (totalEntries > this.maxEntries) {
      const entriesToRemove = totalEntries - this.maxEntries;
      
      // Remove oldest scratchpad entries first
      const scratchpadEntries = Array.from(this.scratchpad.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
      
      let removed = 0;
      for (const [key] of scratchpadEntries) {
        if (removed >= entriesToRemove) break;
        this.scratchpad.delete(key);
        removed++;
      }
      
      // If still over limit, remove oldest key-value entries (except metrics)
      if (removed < entriesToRemove) {
        const keyValueEntries = Array.from(this.keyValueStore.entries())
          .filter(([, entry]) => entry.type !== 'metric')
          .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
        
        for (const [key] of keyValueEntries) {
          if (removed >= entriesToRemove) break;
          this.keyValueStore.delete(key);
          removed++;
        }
      }
    }
  }

  /**
   * Gets memory usage statistics
   */
  public getStats(): {
    scratchpadSize: number;
    keyValueSize: number;
    totalSize: number;
    maxEntries: number;
    utilizationPercent: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const allEntries = this.getAllEntries();
    const timestamps = allEntries.map(e => e.timestamp);
    
    return {
      scratchpadSize: this.scratchpad.size,
      keyValueSize: this.keyValueStore.size,
      totalSize: allEntries.length,
      maxEntries: this.maxEntries,
      utilizationPercent: (allEntries.length / this.maxEntries) * 100,
      oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null,
      newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null,
    };
  }

  /**
   * Clears all memory
   */
  public clear(): void {
    this.scratchpad.clear();
    this.keyValueStore.clear();
  }

  /**
   * Exports all memory data
   */
  public export(): {
    scratchpad: MemoryEntry[];
    keyValue: MemoryEntry[];
    exportedAt: Date;
  } {
    return {
      scratchpad: this.getAllScratchpad(),
      keyValue: this.getAllKeyValue(),
      exportedAt: new Date(),
    };
  }

  /**
   * Imports memory data
   */
  public import(data: {
    scratchpad: MemoryEntry[];
    keyValue: MemoryEntry[];
  }): void {
    this.clear();
    
    for (const entry of data.scratchpad) {
      this.scratchpad.set(entry.key, entry);
    }
    
    for (const entry of data.keyValue) {
      this.keyValueStore.set(entry.key, entry);
    }
  }
}