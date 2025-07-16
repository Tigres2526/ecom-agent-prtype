import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables before importing anything
process.env.GROK_API_KEY = 'test-grok-api-key';
process.env.OPENAI_API_KEY = 'test-openai-api-key';

import { MemoryTools } from './MemoryTools.js';
import { AgentMemory } from '../memory/AgentMemory.js';
import { AgentState } from '../models/AgentState.js';
import { VectorSearch } from '../memory/VectorSearch.js';

// Mock dependencies
vi.mock('../memory/VectorSearch.js');
vi.mock('../memory/AgentMemory.js');

describe('MemoryTools', () => {
  let memoryTools: MemoryTools;
  let mockAgentMemory: AgentMemory;
  let mockAgentState: AgentState;

  beforeEach(() => {
    // Create mock agent state
    mockAgentState = new AgentState(1000, 50, 10);
    
    // Create mock agent memory
    mockAgentMemory = {
      setMemory: vi.fn().mockResolvedValue(undefined),
      getMemory: vi.fn().mockResolvedValue(null),
      writeScratchpad: vi.fn(),
      storeVectorMemory: vi.fn().mockResolvedValue(undefined),
      searchMemory: vi.fn().mockResolvedValue([]),
      getRecentScratchpad: vi.fn().mockReturnValue([]),
    } as any;
    
    // Create memory tools
    memoryTools = new MemoryTools(mockAgentMemory, mockAgentState);
  });

  describe('remember', () => {
    it('should store information in all memory types', async () => {
      const key = 'test_decision';
      const value = { decision: 'Scale campaign', confidence: 0.9 };
      const category = 'decision';

      const result = await memoryTools.remember(key, value, category);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        key,
        category,
        stored: true,
      });

      // Verify all storage methods were called
      expect(mockAgentMemory.setMemory).toHaveBeenCalledWith(key, value);
      expect(mockAgentMemory.writeScratchpad).toHaveBeenCalledWith(
        key,
        JSON.stringify(value),
        mockAgentState.currentDay,
        category
      );
      expect(mockAgentMemory.storeVectorMemory).toHaveBeenCalledWith(
        JSON.stringify(value),
        expect.objectContaining({
          key,
          category,
          day: mockAgentState.currentDay,
        })
      );
    });

    it('should handle string values', async () => {
      const key = 'note';
      const value = 'Important observation about campaign performance';
      const category = 'learning';

      const result = await memoryTools.remember(key, value, category);

      expect(result.success).toBe(true);
      expect(mockAgentMemory.storeVectorMemory).toHaveBeenCalledWith(
        value, // String passed directly
        expect.any(Object)
      );
    });

    it('should handle storage errors', async () => {
      mockAgentMemory.setMemory.mockRejectedValueOnce(new Error('Storage error'));

      const result = await memoryTools.remember('key', 'value', 'decision');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to store memory');
    });
  });

  describe('recall', () => {
    it('should retrieve information from all memory sources', async () => {
      const query = 'campaign performance';
      
      // Mock return values
      mockAgentMemory.getMemory.mockResolvedValueOnce({ data: 'exact match' });
      mockAgentMemory.searchMemory.mockResolvedValueOnce([
        {
          content: 'Campaign scaled successfully',
          similarity: 0.9,
          metadata: { category: 'campaign', day: 5 },
        },
        {
          content: 'Product research completed',
          similarity: 0.7,
          metadata: { category: 'product', day: 3 },
        },
      ]);
      mockAgentMemory.getRecentScratchpad.mockReturnValueOnce([
        {
          key: 'note1',
          content: 'Check campaign metrics',
          day: 10,
          category: 'campaign',
          timestamp: new Date(),
        },
      ]);

      const result = await memoryTools.recall(query);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('exactMatch', { data: 'exact match' });
      expect(result.data).toHaveProperty('semanticMatches');
      expect(result.data).toHaveProperty('recentNotes');
      expect(result.data.semanticMatches).toHaveLength(2);
      expect(result.data.recentNotes).toHaveLength(1);
    });

    it('should filter by category', async () => {
      mockAgentMemory.searchMemory.mockResolvedValueOnce([
        {
          content: 'Campaign scaled',
          similarity: 0.9,
          metadata: { category: 'campaign' },
        },
        {
          content: 'Product found',
          similarity: 0.8,
          metadata: { category: 'product' },
        },
      ]);
      mockAgentMemory.getRecentScratchpad.mockReturnValueOnce([
        {
          key: 'note1',
          content: 'Campaign note',
          day: 10,
          category: 'campaign',
          timestamp: new Date(),
        },
        {
          key: 'note2',
          content: 'Product note',
          day: 10,
          category: 'product',
          timestamp: new Date(),
        },
      ]);

      const result = await memoryTools.recall('test', 'campaign', 5);

      expect(result.success).toBe(true);
      expect(result.data.semanticMatches).toHaveLength(1);
      expect(result.data.semanticMatches[0].metadata?.category).toBe('campaign');
      expect(result.data.recentNotes).toHaveLength(1);
      expect(result.data.recentNotes[0].category).toBe('campaign');
    });

    it('should handle recall errors', async () => {
      mockAgentMemory.searchMemory.mockRejectedValueOnce(new Error('Search error'));

      const result = await memoryTools.recall('query');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to recall memory');
    });
  });

  describe('writeScratchpad', () => {
    it('should write note to scratchpad', async () => {
      const note = 'Important observation';
      const category = 'strategy';

      const result = await memoryTools.writeScratchpad(note, category);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        note,
        day: mockAgentState.currentDay,
        category,
      });
      expect(result.data.key).toMatch(/^note_\d+$/);

      expect(mockAgentMemory.writeScratchpad).toHaveBeenCalledWith(
        expect.stringMatching(/^note_\d+$/),
        note,
        mockAgentState.currentDay,
        category
      );
    });

    it('should use default category if not provided', async () => {
      const note = 'Quick note';

      const result = await memoryTools.writeScratchpad(note);

      expect(result.success).toBe(true);
      expect(result.data.category).toBe('general');
    });

    it('should handle scratchpad errors', async () => {
      mockAgentMemory.writeScratchpad.mockImplementationOnce(() => {
        throw new Error('Write error');
      });

      const result = await memoryTools.writeScratchpad('note');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to write to scratchpad');
    });
  });

  describe('searchDecisions', () => {
    it('should search for decision-related entries', async () => {
      mockAgentMemory.searchMemory.mockResolvedValueOnce([
        {
          content: 'Decided to scale campaign',
          similarity: 0.9,
          metadata: { category: 'decision', day: 5, timestamp: '2024-01-01' },
        },
        {
          content: 'Product analysis complete',
          similarity: 0.8,
          metadata: { category: 'product', day: 3 },
        },
        {
          content: 'Decision: Kill underperforming campaign',
          similarity: 0.85,
          metadata: { category: 'campaign', day: 7 },
        },
      ]);

      const result = await memoryTools.searchDecisions('campaign decisions', 5);

      expect(result.success).toBe(true);
      expect(result.data.decisions).toHaveLength(2); // Only decision-related entries
      expect(result.data.decisions[0].content).toContain('Decided');
      expect(result.data.decisions[1].content).toContain('Decision:');
    });

    it('should handle search errors', async () => {
      mockAgentMemory.searchMemory.mockRejectedValueOnce(new Error('Search failed'));

      const result = await memoryTools.searchDecisions('test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to search decisions');
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory usage statistics', async () => {
      mockAgentMemory.getRecentScratchpad.mockReturnValue([
        {
          key: 'note1',
          content: 'content1',
          day: 1,
          category: 'decision',
          timestamp: new Date(),
        },
        {
          key: 'note2',
          content: 'content2',
          day: 2,
          category: 'product',
          timestamp: new Date(),
        },
        {
          key: 'note3',
          content: 'content3',
          day: 3,
          category: 'decision',
          timestamp: new Date(),
        },
      ]);

      const result = await memoryTools.getMemoryStats();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        scratchpadEntries: 3,
        totalDays: mockAgentState.currentDay,
        currentDay: mockAgentState.currentDay,
      });
      expect(result.data.categoriesUsed).toContain('decision');
      expect(result.data.categoriesUsed).toContain('product');
      expect(result.data.categoriesUsed).toHaveLength(2);
    });

    it('should handle stats errors', async () => {
      mockAgentMemory.getRecentScratchpad.mockImplementationOnce(() => {
        throw new Error('Stats error');
      });

      const result = await memoryTools.getMemoryStats();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get memory stats');
    });
  });
});