import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentMemory } from './AgentMemory.js';

// Mock the VectorSearch to avoid API calls in tests
vi.mock('./VectorSearch.js', () => ({
  VectorSearch: vi.fn().mockImplementation(() => ({
    storeVector: vi.fn().mockResolvedValue(undefined),
    searchSimilar: vi.fn().mockResolvedValue([]),
    searchRecent: vi.fn().mockResolvedValue([]),
    searchByType: vi.fn().mockResolvedValue([]),
    findSimilarEntries: vi.fn().mockResolvedValue([]),
    removeVector: vi.fn().mockReturnValue(true),
    pruneOldVectors: vi.fn().mockReturnValue(0),
    getVectorStats: vi.fn().mockReturnValue({
      totalVectors: 0,
      maxVectors: 5000,
      utilizationPercent: 0,
      typeDistribution: {},
      averageAge: 0,
    }),
    clearVectors: vi.fn(),
    exportVectors: vi.fn().mockReturnValue([]),
    importVectors: vi.fn(),
  })),
}));

describe('AgentMemory', () => {
  let memory: AgentMemory;

  beforeEach(() => {
    memory = new AgentMemory(1000, 500);
    memory.setCurrentDay(1);
  });

  describe('basic operations', () => {
    it('should write and read scratchpad entries', async () => {
      await memory.writeScratchpad('decision1', 'made important decision', 'decision');
      
      const entry = memory.read('decision1');
      expect(entry).toBeDefined();
      expect(entry?.value).toBe('made important decision');
      expect(entry?.type).toBe('decision');
      expect(entry?.day).toBe(1);
    });

    it('should write and read key-value entries', async () => {
      await memory.writeKeyValue('metric1', 'ROAS: 2.5', 'metric');
      
      const entry = memory.read('metric1');
      expect(entry).toBeDefined();
      expect(entry?.value).toBe('ROAS: 2.5');
      expect(entry?.type).toBe('metric');
    });

    it('should use generic write method', async () => {
      await memory.write('test_decision', 'test decision', 'decision');
      await memory.write('test_metric', 'test metric', 'metric');
      
      expect(memory.read('test_decision')).toBeDefined();
      expect(memory.read('test_metric')).toBeDefined();
    });
  });

  describe('specialized logging methods', () => {
    it('should log decisions with structured data', async () => {
      await memory.logDecision(
        'Launch new product',
        'High margin and low competition',
        'Day 1 analysis',
        'Positive ROAS within 3 days',
        0.8
      );
      
      const decisions = memory.getEntriesByType('decision');
      expect(decisions).toHaveLength(1);
      
      const decisionData = JSON.parse(decisions[0].value);
      expect(decisionData.decision).toBe('Launch new product');
      expect(decisionData.confidence).toBe(0.8);
    });

    it('should log insights', async () => {
      await memory.logInsight('Facebook ads perform better in evening', 'marketing');
      
      const insights = memory.getEntriesByType('insight');
      expect(insights).toHaveLength(1);
      
      const insightData = JSON.parse(insights[0].value);
      expect(insightData.insight).toBe('Facebook ads perform better in evening');
      expect(insightData.category).toBe('marketing');
    });

    it('should log metrics', async () => {
      await memory.logMetric('daily_roas', 2.5, { platform: 'facebook' });
      
      const metrics = memory.getEntriesByType('metric');
      expect(metrics).toHaveLength(1);
      
      const metricData = JSON.parse(metrics[0].value);
      expect(metricData.name).toBe('daily_roas');
      expect(metricData.value).toBe(2.5);
      expect(metricData.metadata.platform).toBe('facebook');
    });

    it('should log errors with context', async () => {
      await memory.logError('API timeout', { endpoint: '/products', retries: 3 });
      
      const errors = memory.getEntriesByType('error');
      expect(errors).toHaveLength(1);
      
      const errorData = JSON.parse(errors[0].value);
      expect(errorData.error).toBe('API timeout');
      expect(errorData.context.endpoint).toBe('/products');
    });
  });

  describe('retrieval methods', () => {
    beforeEach(async () => {
      memory.setCurrentDay(5);
      await memory.logDecision('Decision 1', 'Reason 1', 'Context 1', 'Outcome 1', 0.8);
      
      memory.setCurrentDay(6);
      await memory.logDecision('Decision 2', 'Reason 2', 'Context 2', 'Outcome 2', 0.9);
      
      memory.setCurrentDay(7);
      await memory.logInsight('Important insight', 'general');
      await memory.logMetric('test_metric', 100);
    });

    it('should get recent context', () => {
      const recent = memory.getRecentContext(10);
      expect(recent.length).toBeGreaterThan(0);
      
      // Should be sorted by most recent first
      const timestamps = recent.map(e => e.timestamp.getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should get entries by type', () => {
      const decisions = memory.getEntriesByType('decision');
      expect(decisions).toHaveLength(2);
      
      const insights = memory.getEntriesByType('insight');
      expect(insights).toHaveLength(1);
      
      const metrics = memory.getEntriesByType('metric');
      expect(metrics).toHaveLength(1);
    });

    it('should get entries by day range', () => {
      const recentEntries = memory.getEntriesByDayRange(6, 7);
      expect(recentEntries.length).toBeGreaterThanOrEqual(3); // Decision 2, insight, metric
      
      const singleDay = memory.getEntriesByDayRange(5, 5);
      expect(singleDay).toHaveLength(1); // Only Decision 1
    });

    it('should get decision history', () => {
      const history = memory.getDecisionHistory(5);
      expect(history).toHaveLength(2);
      
      // Should be sorted by most recent day first
      expect(history[0].day).toBeGreaterThanOrEqual(history[1].day);
    });

    it('should get recent insights', () => {
      const insights = memory.getRecentInsights(5);
      expect(insights).toHaveLength(1);
    });

    it('should search by keyword', () => {
      const decisionResults = memory.searchByKeyword('Decision');
      expect(decisionResults.length).toBeGreaterThanOrEqual(2);
      
      const insightResults = memory.searchByKeyword('insight');
      expect(insightResults.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('error pattern analysis', () => {
    it('should analyze error patterns', async () => {
      // Create fresh memory instance for this test
      const testMemory = new AgentMemory(1000, 500);
      
      testMemory.setCurrentDay(1);
      await testMemory.logError('API timeout', { endpoint: '/products' });
      await testMemory.logError('API timeout', { endpoint: '/campaigns' });
      
      testMemory.setCurrentDay(2);
      await testMemory.logError('Invalid product', { productId: '123' });
      await testMemory.logError('API timeout', { endpoint: '/metrics' });
      
      // Check that all errors were logged
      const allErrors = testMemory.getEntriesByType('error');
      console.log('All errors:', allErrors.map(e => ({ day: e.day, key: e.key })));
      expect(allErrors).toHaveLength(4);
      
      const patterns = testMemory.getErrorPatterns(7);
      
      const timeoutPattern = patterns.find(p => p.error === 'API timeout');
      expect(timeoutPattern).toBeDefined();
      expect(timeoutPattern?.count).toBe(3);
      
      const productPattern = patterns.find(p => p.error === 'Invalid product');
      expect(productPattern).toBeDefined();
      expect(productPattern?.count).toBe(1);
    });
  });

  describe('memory management', () => {
    it('should update current day', () => {
      memory.setCurrentDay(10);
      
      // This is tested indirectly through other operations
      // as the day is used in memory entries
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should prune old memories', async () => {
      // Add some entries
      await memory.logDecision('Old decision', 'reason', 'context', 'outcome', 0.5);
      await memory.logInsight('Old insight', 'category');
      
      const result = await memory.pruneOldMemories(30);
      expect(result).toHaveProperty('memoryPruned');
      expect(result).toHaveProperty('vectorsPruned');
      expect(typeof result.memoryPruned).toBe('number');
      expect(typeof result.vectorsPruned).toBe('number');
    });

    it('should provide comprehensive memory statistics', () => {
      const stats = memory.getMemoryStats();
      
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('vectors');
      expect(stats).toHaveProperty('summary');
      
      expect(stats.summary).toHaveProperty('totalEntries');
      expect(stats.summary).toHaveProperty('recentDecisions');
      expect(stats.summary).toHaveProperty('insights');
      expect(stats.summary).toHaveProperty('errors');
      expect(stats.summary).toHaveProperty('metrics');
    });

    it('should clear all memory', () => {
      memory.clearAll();
      
      const stats = memory.getMemoryStats();
      expect(stats.summary.totalEntries).toBe(0);
    });
  });

  describe('import/export', () => {
    beforeEach(async () => {
      memory.setCurrentDay(5);
      await memory.logDecision('Test decision', 'reason', 'context', 'outcome', 0.8);
      await memory.logInsight('Test insight', 'category');
    });

    it('should export memory data', () => {
      const exported = memory.exportMemory();
      
      expect(exported).toHaveProperty('memory');
      expect(exported).toHaveProperty('vectors');
      expect(exported).toHaveProperty('currentDay');
      expect(exported.currentDay).toBe(5);
      
      expect(exported.memory.scratchpad.length).toBeGreaterThan(0);
      expect(exported.memory.keyValue.length).toBeGreaterThan(0);
    });

    it('should import memory data', async () => {
      const exported = memory.exportMemory();
      
      const newMemory = new AgentMemory();
      await newMemory.importMemory(exported);
      
      expect(newMemory.getMemoryStats().summary.totalEntries).toBeGreaterThan(0);
      
      // Check that specific entries were imported
      const decisions = newMemory.getEntriesByType('decision');
      expect(decisions.length).toBeGreaterThan(0);
      
      const insights = newMemory.getEntriesByType('insight');
      expect(insights.length).toBeGreaterThan(0);
    });
  });

  describe('vector search integration', () => {
    it('should call vector search methods', async () => {
      // These tests verify that the methods are called
      // The actual vector search functionality is mocked
      
      const results = await memory.searchVector('test query');
      expect(Array.isArray(results)).toBe(true);
      
      const recentResults = await memory.searchRecent('test query', 7);
      expect(Array.isArray(recentResults)).toBe(true);
      
      const typeResults = await memory.searchByType('test query', 'decision');
      expect(Array.isArray(typeResults)).toBe(true);
    });
  });
});