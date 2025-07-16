import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from './ToolRegistry.js';
import { ProductResearchTools } from './ProductResearchTools.js';
import { CampaignManagementTools } from './CampaignManagementTools.js';
import { MarketingAngleTools } from './MarketingAngleTools.js';
import { MemoryTools } from './MemoryTools.js';
import { AnalyticsTools } from './AnalyticsTools.js';
import { AgentState } from '../models/AgentState.js';
import { AgentMemory } from '../memory/AgentMemory.js';
import { GrokClient } from '../agent/GrokClient.js';

// Mock all dependencies
vi.mock('./ProductResearchTools.js');
vi.mock('./CampaignManagementTools.js');
vi.mock('./MarketingAngleTools.js');
vi.mock('./MemoryTools.js');
vi.mock('./AnalyticsTools.js');
vi.mock('../agent/GrokClient.js');

describe('ToolRegistry', () => {
  let toolRegistry: ToolRegistry;
  let mockProductTools: any;
  let mockCampaignTools: any;
  let mockMarketingTools: any;
  let mockMemoryTools: any;
  let mockAnalyticsTools: any;
  let mockAgentState: AgentState;
  let mockAgentMemory: AgentMemory;

  beforeEach(() => {
    // Create mock instances
    mockProductTools = {
      searchProducts: vi.fn().mockResolvedValue({ success: true, data: [] }),
      analyzeProduct: vi.fn().mockResolvedValue({ success: true, data: {} }),
      spyCompetitors: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    mockCampaignTools = {
      createCampaign: vi.fn().mockResolvedValue({ success: true, data: { campaignId: '123' } }),
      checkMetrics: vi.fn().mockResolvedValue({ success: true, data: {} }),
      scaleCampaign: vi.fn().mockResolvedValue({ success: true, data: {} }),
      killCampaign: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    mockMarketingTools = {
      generateAngles: vi.fn().mockResolvedValue({ success: true, data: { angles: [] } }),
      testAngles: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    mockMemoryTools = {
      remember: vi.fn().mockResolvedValue({ success: true, data: {} }),
      recall: vi.fn().mockResolvedValue({ success: true, data: {} }),
      writeScratchpad: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    mockAnalyticsTools = {
      analyzePerformance: vi.fn().mockResolvedValue({ success: true, data: {} }),
      generateReport: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    // Create tool registry
    toolRegistry = new ToolRegistry(
      mockProductTools,
      mockCampaignTools,
      mockMarketingTools,
      mockMemoryTools,
      mockAnalyticsTools
    );
  });

  describe('Tool Registration', () => {
    it('should register all tools on initialization', () => {
      const allTools = toolRegistry.getAllTools();
      
      // Check that all expected tools are registered
      const toolNames = allTools.map(tool => tool.function.name);
      
      expect(toolNames).toContain('search_products');
      expect(toolNames).toContain('analyze_product');
      expect(toolNames).toContain('spy_competitors');
      expect(toolNames).toContain('create_campaign');
      expect(toolNames).toContain('check_metrics');
      expect(toolNames).toContain('scale_campaign');
      expect(toolNames).toContain('kill_campaign');
      expect(toolNames).toContain('generate_angles');
      expect(toolNames).toContain('test_angles');
      expect(toolNames).toContain('remember');
      expect(toolNames).toContain('recall');
      expect(toolNames).toContain('write_scratchpad');
      expect(toolNames).toContain('analyze_performance');
      expect(toolNames).toContain('generate_report');
    });

    it('should get tool by name', () => {
      const tool = toolRegistry.getTool('search_products');
      
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('search_products');
      expect(tool?.category).toBe('product');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = toolRegistry.getTool('non_existent_tool');
      expect(tool).toBeUndefined();
    });

    it('should get tools by category', () => {
      const productTools = toolRegistry.getToolsByCategory('product');
      const campaignTools = toolRegistry.getToolsByCategory('campaign');
      
      expect(productTools.length).toBe(3); // search_products, analyze_product, spy_competitors
      expect(campaignTools.length).toBe(6); // create, check, scale, kill, generate_angles, test_angles
      
      // Check all product tools
      const productToolNames = productTools.map(t => t.function.name);
      expect(productToolNames).toContain('search_products');
      expect(productToolNames).toContain('analyze_product');
      expect(productToolNames).toContain('spy_competitors');
    });
  });

  describe('Tool Execution', () => {
    it('should execute search_products tool successfully', async () => {
      const params = {
        query: 'wireless charger',
        platform: 'all',
        minMargin: 30,
      };

      const result = await toolRegistry.executeTool('search_products', params);

      expect(result.success).toBe(true);
      expect(mockProductTools.searchProducts).toHaveBeenCalledWith(
        'wireless charger',
        'all',
        30,
        undefined
      );
    });

    it('should execute create_campaign tool successfully', async () => {
      const params = {
        product: { id: 'prod1', name: 'Test Product' },
        platform: 'facebook',
        budget: 50,
        angle: 'Problem solver',
      };

      const result = await toolRegistry.executeTool('create_campaign', params);

      expect(result.success).toBe(true);
      expect(mockCampaignTools.createCampaign).toHaveBeenCalledWith(
        params.product,
        'facebook',
        50,
        'Problem solver',
        undefined
      );
    });

    it('should validate parameters before execution', async () => {
      const invalidParams = {
        query: 'test',
        platform: 'invalid_platform', // Should be enum
      };

      const result = await toolRegistry.executeTool('search_products', invalidParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid parameters');
    });

    it('should handle tool execution errors', async () => {
      mockProductTools.searchProducts.mockRejectedValueOnce(new Error('API error'));

      const result = await toolRegistry.executeTool('search_products', {
        query: 'test',
        platform: 'all',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });

    it('should return error for non-existent tool', async () => {
      const result = await toolRegistry.executeTool('non_existent_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool \'non_existent_tool\' not found');
    });
  });

  describe('Tool Schema Conversion', () => {
    it('should convert tools to proper JSON schema format', () => {
      const allTools = toolRegistry.getAllTools();
      const searchProductsTool = allTools.find(t => t.function.name === 'search_products');

      expect(searchProductsTool).toBeDefined();
      expect(searchProductsTool?.type).toBe('function');
      expect(searchProductsTool?.function.parameters).toHaveProperty('type', 'object');
      expect(searchProductsTool?.function.parameters).toHaveProperty('properties');
      
      const properties = searchProductsTool?.function.parameters.properties;
      expect(properties).toHaveProperty('query');
      expect(properties).toHaveProperty('platform');
      expect(properties.platform).toHaveProperty('enum');
    });

    it('should mark required fields correctly', () => {
      const allTools = toolRegistry.getAllTools();
      const createCampaignTool = allTools.find(t => t.function.name === 'create_campaign');

      expect(createCampaignTool?.function.parameters.required).toContain('product');
      expect(createCampaignTool?.function.parameters.required).toContain('platform');
      expect(createCampaignTool?.function.parameters.required).toContain('budget');
      expect(createCampaignTool?.function.parameters.required).toContain('angle');
      expect(createCampaignTool?.function.parameters.required).not.toContain('audience');
    });

    it('should handle default values in schema', () => {
      const allTools = toolRegistry.getAllTools();
      const recallTool = allTools.find(t => t.function.name === 'recall');

      const limitProperty = recallTool?.function.parameters.properties.limit;
      expect(limitProperty).toHaveProperty('default', 5);
    });
  });

  describe('Memory Tools', () => {
    it('should execute remember tool', async () => {
      const params = {
        key: 'important_decision',
        value: { decision: 'Scale campaign', reason: 'High ROAS' },
        category: 'decision',
      };

      const result = await toolRegistry.executeTool('remember', params);

      expect(result.success).toBe(true);
      expect(mockMemoryTools.remember).toHaveBeenCalledWith(
        'important_decision',
        params.value,
        'decision'
      );
    });

    it('should execute recall tool', async () => {
      const params = {
        query: 'campaign decisions',
        category: 'decision',
        limit: 10,
      };

      const result = await toolRegistry.executeTool('recall', params);

      expect(result.success).toBe(true);
      expect(mockMemoryTools.recall).toHaveBeenCalledWith(
        'campaign decisions',
        'decision',
        10
      );
    });
  });

  describe('Analytics Tools', () => {
    it('should execute analyze_performance tool', async () => {
      const params = {
        timeframe: 'last7days',
        metrics: ['revenue', 'roas'],
      };

      const result = await toolRegistry.executeTool('analyze_performance', params);

      expect(result.success).toBe(true);
      expect(mockAnalyticsTools.analyzePerformance).toHaveBeenCalledWith(
        'last7days',
        ['revenue', 'roas']
      );
    });

    it('should execute generate_report tool', async () => {
      const params = {
        type: 'weekly',
      };

      const result = await toolRegistry.executeTool('generate_report', params);

      expect(result.success).toBe(true);
      expect(mockAnalyticsTools.generateReport).toHaveBeenCalledWith(
        'weekly',
        undefined,
        undefined
      );
    });
  });
});