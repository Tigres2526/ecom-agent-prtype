import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from './MemoryStore.js';

describe('MemoryStore', () => {
  let memoryStore: MemoryStore;

  beforeEach(() => {
    memoryStore = new MemoryStore(100); // Small limit for testing
  });

  describe('basic operations', () => {
    it('should write and read scratchpad entries', () => {
      memoryStore.writeScratchpad('test_key', 'test_value', 1, 'decision');
      
      const entry = memoryStore.readScratchpad('test_key');
      expect(entry).toBeDefined();
      expect(entry?.key).toBe('test_key');
      expect(entry?.value).toBe('test_value');
      expect(entry?.day).toBe(1);
      expect(entry?.type).toBe('decision');
    });

    it('should write and read key-value entries', () => {
      memoryStore.writeKeyValue('metric_key', 'metric_value', 1, 'metric');
      
      const entry = memoryStore.readKeyValue('metric_key');
      expect(entry).toBeDefined();
      expect(entry?.key).toBe('metric_key');
      expect(entry?.value).toBe('metric_value');
      expect(entry?.type).toBe('metric');
    });

    it('should read from both stores with generic read', () => {
      memoryStore.writeScratchpad('scratch_key', 'scratch_value', 1);
      memoryStore.writeKeyValue('kv_key', 'kv_value', 1);
      
      expect(memoryStore.read('scratch_key')).toBeDefined();
      expect(memoryStore.read('kv_key')).toBeDefined();
      expect(memoryStore.read('nonexistent')).toBeNull();
    });

    it('should prioritize scratchpad over key-value in generic read', () => {
      memoryStore.writeScratchpad('same_key', 'scratchpad_value', 1);
      memoryStore.writeKeyValue('same_key', 'keyvalue_value', 1);
      
      const entry = memoryStore.read('same_key');
      expect(entry?.value).toBe('scratchpad_value');
    });
  });

  describe('retrieval methods', () => {
    beforeEach(async () => {
      memoryStore.writeScratchpad('decision1', 'made decision A', 1, 'decision');
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      memoryStore.writeScratchpad('decision2', 'made decision B', 2, 'decision');
      memoryStore.writeKeyValue('metric1', 'ROAS: 2.5', 1, 'metric');
      memoryStore.writeKeyValue('insight1', 'learned something', 2, 'insight');
    });

    it('should get all entries', () => {
      const allEntries = memoryStore.getAllEntries();
      expect(allEntries).toHaveLength(4);
    });

    it('should get recent scratchpad entries', () => {
      const recent = memoryStore.getRecentScratchpad(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].key).toBe('decision2'); // Most recent
    });

    it('should get entries by type', () => {
      const decisions = memoryStore.getEntriesByType('decision');
      expect(decisions).toHaveLength(2);
      
      const metrics = memoryStore.getEntriesByType('metric');
      expect(metrics).toHaveLength(1);
    });

    it('should get entries by day range', () => {
      const day1Entries = memoryStore.getEntriesByDayRange(1, 1);
      expect(day1Entries).toHaveLength(2); // decision1 and metric1
      
      const allDays = memoryStore.getEntriesByDayRange(1, 2);
      expect(allDays).toHaveLength(4);
    });

    it('should search by key pattern', () => {
      const decisionEntries = memoryStore.searchByKey('decision');
      expect(decisionEntries).toHaveLength(2);
      
      const specificEntry = memoryStore.searchByKey('decision1');
      expect(specificEntry).toHaveLength(1);
    });

    it('should search by value content', () => {
      const decisionEntries = memoryStore.searchByValue('decision');
      expect(decisionEntries).toHaveLength(2);
      
      const roasEntries = memoryStore.searchByValue('ROAS');
      expect(roasEntries).toHaveLength(1);
    });
  });

  describe('deletion', () => {
    beforeEach(() => {
      memoryStore.writeScratchpad('scratch_key', 'value', 1);
      memoryStore.writeKeyValue('kv_key', 'value', 1);
    });

    it('should delete from scratchpad', () => {
      expect(memoryStore.deleteScratchpad('scratch_key')).toBe(true);
      expect(memoryStore.readScratchpad('scratch_key')).toBeNull();
      expect(memoryStore.deleteScratchpad('nonexistent')).toBe(false);
    });

    it('should delete from key-value store', () => {
      expect(memoryStore.deleteKeyValue('kv_key')).toBe(true);
      expect(memoryStore.readKeyValue('kv_key')).toBeNull();
      expect(memoryStore.deleteKeyValue('nonexistent')).toBe(false);
    });

    it('should delete from both stores with generic delete', () => {
      expect(memoryStore.delete('scratch_key')).toBe(true);
      expect(memoryStore.delete('kv_key')).toBe(true);
      expect(memoryStore.delete('nonexistent')).toBe(false);
    });
  });

  describe('memory management', () => {
    it('should prune old entries', () => {
      // Create entries with different timestamps
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days ago
      
      memoryStore.writeScratchpad('old_entry', 'old_value', 1);
      memoryStore.writeKeyValue('old_metric', 'old_metric_value', 1, 'metric');
      memoryStore.writeKeyValue('old_insight', 'old_insight_value', 1, 'insight');
      
      // Manually set old timestamp for testing
      const scratchpadEntries = memoryStore.getAllScratchpad();
      const keyValueEntries = memoryStore.getAllKeyValue();
      
      if (scratchpadEntries.length > 0) {
        scratchpadEntries[0].timestamp = oldDate;
      }
      
      // Find non-metric entry and set old timestamp
      const nonMetricEntry = keyValueEntries.find(e => e.type !== 'metric');
      if (nonMetricEntry) {
        nonMetricEntry.timestamp = oldDate;
      }
      
      const prunedCount = memoryStore.pruneOldEntries(30);
      expect(prunedCount).toBeGreaterThan(0);
      
      // Metrics should be preserved
      const remainingMetrics = memoryStore.getEntriesByType('metric');
      expect(remainingMetrics).toHaveLength(1);
    });

    it('should enforce memory limits', () => {
      const smallStore = new MemoryStore(5);
      
      // Add more entries than the limit
      for (let i = 0; i < 10; i++) {
        smallStore.writeScratchpad(`key${i}`, `value${i}`, i);
      }
      
      const stats = smallStore.getStats();
      expect(stats.totalSize).toBeLessThanOrEqual(5);
    });

    it('should provide memory statistics', () => {
      memoryStore.writeScratchpad('test1', 'value1', 1);
      memoryStore.writeKeyValue('test2', 'value2', 1);
      
      const stats = memoryStore.getStats();
      expect(stats.scratchpadSize).toBe(1);
      expect(stats.keyValueSize).toBe(1);
      expect(stats.totalSize).toBe(2);
      expect(stats.maxEntries).toBe(100);
      expect(stats.utilizationPercent).toBe(2);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });
  });

  describe('import/export', () => {
    it('should export and import data', () => {
      memoryStore.writeScratchpad('scratch1', 'value1', 1);
      memoryStore.writeKeyValue('kv1', 'value2', 1);
      
      const exported = memoryStore.export();
      expect(exported.scratchpad).toHaveLength(1);
      expect(exported.keyValue).toHaveLength(1);
      expect(exported.exportedAt).toBeInstanceOf(Date);
      
      const newStore = new MemoryStore();
      newStore.import(exported);
      
      expect(newStore.read('scratch1')).toBeDefined();
      expect(newStore.read('kv1')).toBeDefined();
    });

    it('should clear all memory', () => {
      memoryStore.writeScratchpad('test1', 'value1', 1);
      memoryStore.writeKeyValue('test2', 'value2', 1);
      
      expect(memoryStore.getStats().totalSize).toBe(2);
      
      memoryStore.clear();
      expect(memoryStore.getStats().totalSize).toBe(0);
    });
  });
});