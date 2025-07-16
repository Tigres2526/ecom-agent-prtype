import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DecisionEngine } from './DecisionEngine.js';
import { GrokClient } from './GrokClient.js';
import { ContextManager } from './ContextManager.js';
import { AgentState } from '../models/AgentState.js';
import { Product } from '../models/Product.js';
import { Campaign } from '../models/Campaign.js';

// Mock the GrokClient
vi.mock('./GrokClient.js', () => ({
  GrokClient: vi.fn().mockImplementation(() => ({
    chatCompletion: vi.fn(),
    simpleChat: vi.fn(),
    chatWithSearch: vi.fn(),
  })),
}));

// Mock the ContextManager
vi.mock('./ContextManager.js', () => ({
  ContextManager: vi.fn().mockImplementation(() => ({
    addSystemMessage: vi.fn(),
    addUserMessage: vi.fn(),
    addAssistantMessage: vi.fn(),
    getMessagesForGrok: vi.fn().mockReturnValue([]),
  })),
}));

describe('DecisionEngine', () => {
  let decisionEngine: DecisionEngine;
  let mockGrokClient: any;
  let mockContextManager: any;
  let agentState: AgentState;
  let config: any;

  beforeEach(() => {
    mockGrokClient = new GrokClient();
    mockContextManager = new ContextManager();
    
    config = {
      initialCapital: 1000,
      dailyAdSpend: 50,
      targetROAS: 2.0,
      maxDays: 200,
      maxContextTokens: 30000,
      maxActionsPerDay: 50,
      bankruptcyThreshold: 10,
    };

    agentState = new AgentState(1000, 50, 10);
    agentState.updateFinancials(500, 250); // Set some initial metrics

    decisionEngine = new DecisionEngine(mockGrokClient, mockContextManager, config);
  });

  describe('decision making', () => {
    it('should make a strategic decision', async () => {
      const mockResponse = {
        content: `DECISION: Launch new product research
REASONING: Current ROAS is good but we need more products in pipeline
EXPECTED OUTCOME: Find 2-3 new profitable products within 3 days
CONFIDENCE: 0.8`,
        toolCalls: [{ name: 'search_products', parameters: { query: 'trending products' } }],
      };

      mockGrokClient.chatCompletion.mockResolvedValueOnce(mockResponse);

      const availableTools = [{
        type: 'function' as const,
        function: {
          name: 'search_products',
          description: 'Search for products',
          parameters: { type: 'object', properties: {} },
        },
      }];

      const decision = await decisionEngine.makeDecision(agentState, availableTools);

      expect(decision.decision).toBe('Launch new product research');
      expect(decision.reasoning).toBe('Current ROAS is good but we need more products in pipeline');
      expect(decision.confidence).toBe(0.8);
      expect(decision.expectedOutcome).toBe('Find 2-3 new profitable products within 3 days');
      expect(decision.toolCalls).toHaveLength(1);
      expect(decision.urgency).toBe('medium');
    });

    it('should handle AI failure with conservative decision', async () => {
      mockGrokClient.chatCompletion.mockRejectedValueOnce(new Error('API Error'));

      const decision = await decisionEngine.makeDecision(agentState, []);

      expect(decision.decision).toContain('monitoring');
      expect(decision.reasoning).toContain('AI decision engine failed');
      expect(decision.confidence).toBeLessThan(0.8);
      expect(decision.urgency).toBe('medium');
    });

    it('should make critical decision when bankrupt', async () => {
      // Force bankruptcy
      const bankruptState = new AgentState(100, 50, 2);
      bankruptState.advanceDay();
      bankruptState.advanceDay();
      bankruptState.advanceDay(); // Should be bankrupt now

      mockGrokClient.chatCompletion.mockRejectedValueOnce(new Error('API Error'));

      const decision = await decisionEngine.makeDecision(bankruptState, []);

      expect(decision.decision).toContain('emergency');
      expect(decision.urgency).toBe('critical');
      expect(decision.confidence).toBeGreaterThan(0.8);
    });

    it('should handle high error count with recovery mode', async () => {
      // Set high error count
      for (let i = 0; i < 12; i++) {
        agentState.incrementErrorCount();
      }

      mockGrokClient.chatCompletion.mockRejectedValueOnce(new Error('API Error'));

      const decision = await decisionEngine.makeDecision(agentState, []);

      expect(decision.decision).toContain('recovery mode');
      expect(decision.urgency).toBe('high');
    });
  });

  describe('system prompt generation', () => {
    it('should generate comprehensive system prompt', async () => {
      // Add some products and campaigns to state
      const product = new Product({
        name: 'Test Product',
        sourceUrl: 'https://example.com',
        supplierPrice: 10,
        recommendedPrice: 30,
        margin: 20,
        contentScore: 75,
        competitorCount: 15,
        status: 'testing',
        createdDay: 1,
      });

      const campaign = new Campaign({
        productId: product.id,
        platform: 'facebook',
        angle: 'Problem solving',
        budget: 100,
        spend: 50,
        revenue: 150,
        roas: 3.0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });

      agentState.addProduct(product);
      agentState.addCampaign(campaign);

      mockGrokClient.chatCompletion.mockResolvedValueOnce({
        content: 'Test decision',
        toolCalls: [],
      });

      await decisionEngine.makeDecision(agentState, []);

      // Verify system message was added with comprehensive info
      expect(mockContextManager.addSystemMessage).toHaveBeenCalledWith(
        expect.stringContaining('autonomous dropshipping brand manager')
      );
      expect(mockContextManager.addSystemMessage).toHaveBeenCalledWith(
        expect.stringContaining(`Day: ${agentState.currentDay}`)
      );
      expect(mockContextManager.addSystemMessage).toHaveBeenCalledWith(
        expect.stringContaining(`Net Worth: $${agentState.netWorth.toFixed(2)}`)
      );
    });
  });

  describe('situation analysis', () => {
    it('should analyze specific situation with search', async () => {
      const mockResponse = {
        content: `ANALYSIS: The market is showing strong demand for this product category
RECOMMENDATIONS:
1. Launch test campaigns with small budgets
2. Focus on video creative content
3. Target younger demographics
RISKS:
- High competition
- Seasonal demand
OPPORTUNITIES:
- Untapped micro-niches
- Influencer partnerships`,
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await decisionEngine.analyzeSpecificSituation(
        'New product category showing high search volume',
        agentState,
        { useSearch: true, focusArea: 'market' }
      );

      expect(result.analysis).toContain('strong demand');
      expect(result.recommendations).toHaveLength(3);
      expect(result.recommendations[0]).toBe('Launch test campaigns with small budgets');
      expect(result.risks).toContain('High competition');
      expect(result.opportunities).toContain('Untapped micro-niches');
    });

    it('should handle analysis failure gracefully', async () => {
      mockGrokClient.simpleChat.mockRejectedValueOnce(new Error('Analysis failed'));

      const result = await decisionEngine.analyzeSpecificSituation(
        'Test situation',
        agentState
      );

      expect(result.analysis).toContain('failed due to technical error');
      expect(result.recommendations).toContain('Monitor situation closely');
      expect(result.risks).toContain('Technical analysis unavailable');
    });

    it('should generate focused prompts for different areas', async () => {
      mockGrokClient.simpleChat.mockResolvedValue('Test analysis');

      // Test financial focus
      await decisionEngine.analyzeSpecificSituation(
        'Financial situation',
        agentState,
        { focusArea: 'financial' }
      );

      expect(mockGrokClient.simpleChat).toHaveBeenCalledWith(
        expect.stringContaining('financial analysis'),
        expect.any(String)
      );

      // Test product focus
      await decisionEngine.analyzeSpecificSituation(
        'Product situation',
        agentState,
        { focusArea: 'product' }
      );

      expect(mockGrokClient.simpleChat).toHaveBeenCalledWith(
        expect.stringContaining('product analysis'),
        expect.any(String)
      );
    });
  });

  describe('response parsing', () => {
    it('should parse structured decision response', async () => {
      const mockResponse = {
        content: `DECISION: Scale winning campaigns
REASONING: Facebook campaign showing 3.5 ROAS consistently
EXPECTED OUTCOME: Increase daily revenue by 40%
CONFIDENCE: 0.9
This is a high priority action.`,
        toolCalls: [{ name: 'scale_campaign', parameters: { campaignId: '123', newBudget: 200 } }],
      };

      mockGrokClient.chatCompletion.mockResolvedValueOnce(mockResponse);

      const decision = await decisionEngine.makeDecision(agentState, []);

      expect(decision.decision).toBe('Scale winning campaigns');
      expect(decision.reasoning).toBe('Facebook campaign showing 3.5 ROAS consistently');
      expect(decision.expectedOutcome).toBe('Increase daily revenue by 40%');
      expect(decision.confidence).toBe(0.9);
      expect(decision.urgency).toBe('high'); // Should detect 'high priority'
    });

    it('should determine urgency from keywords', async () => {
      const criticalResponse = {
        content: 'DECISION: Emergency stop all campaigns - bankruptcy imminent',
        toolCalls: [],
      };

      mockGrokClient.chatCompletion.mockResolvedValueOnce(criticalResponse);

      const decision = await decisionEngine.makeDecision(agentState, []);
      expect(decision.urgency).toBe('critical');
    });

    it('should handle percentage confidence format', async () => {
      const mockResponse = {
        content: 'DECISION: Test decision\nI am 85% confident in this approach.',
        toolCalls: [],
      };

      mockGrokClient.chatCompletion.mockResolvedValueOnce(mockResponse);

      const decision = await decisionEngine.makeDecision(agentState, []);
      expect(decision.confidence).toBe(0.85);
    });
  });

  describe('decision logging', () => {
    it('should create decision log entry', () => {
      const decision = {
        decision: 'Test decision',
        reasoning: 'Test reasoning',
        confidence: 0.8,
        expectedOutcome: 'Test outcome',
        urgency: 'medium' as const,
      };

      const log = decisionEngine.createDecisionLog(decision, agentState, 'Test context');

      expect(log.day).toBe(agentState.currentDay);
      expect(log.decision).toBe('Test decision');
      expect(log.reasoning).toBe('Test reasoning');
      expect(log.confidence).toBe(0.8);
      expect(log.expectedOutcome).toBe('Test outcome');
      expect(log.context).toBe('Test context');
      expect(log.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('campaign and product summarization', () => {
    it('should summarize campaigns correctly', async () => {
      const campaign1 = new Campaign({
        productId: '550e8400-e29b-41d4-a716-446655440001',
        platform: 'facebook',
        angle: 'Problem solving',
        budget: 100,
        spend: 75,
        revenue: 225,
        roas: 3.0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });

      const campaign2 = new Campaign({
        productId: '550e8400-e29b-41d4-a716-446655440002',
        platform: 'tiktok',
        angle: 'Lifestyle',
        budget: 50,
        spend: 60,
        revenue: 60,
        roas: 1.0,
        status: 'active',
        createdDay: 2,
        lastOptimized: 2,
      });

      agentState.addCampaign(campaign1);
      agentState.addCampaign(campaign2);

      mockGrokClient.chatCompletion.mockResolvedValueOnce({
        content: 'Test decision',
        toolCalls: [],
      });

      await decisionEngine.makeDecision(agentState, []);

      // Verify the situation analysis includes campaign summaries
      expect(mockContextManager.addUserMessage).toHaveBeenCalledWith(
        expect.stringContaining('facebook campaign (Problem solving)')
      );
      expect(mockContextManager.addUserMessage).toHaveBeenCalledWith(
        expect.stringContaining('ROAS 3.00, excellent')
      );
      expect(mockContextManager.addUserMessage).toHaveBeenCalledWith(
        expect.stringContaining('tiktok campaign (Lifestyle)')
      );
    });

    it('should summarize products correctly', async () => {
      const product = new Product({
        name: 'Test Product',
        sourceUrl: 'https://example.com',
        supplierPrice: 10,
        recommendedPrice: 30,
        margin: 20,
        contentScore: 80,
        competitorCount: 12,
        status: 'scaling',
        createdDay: 1,
      });

      agentState.addProduct(product);

      mockGrokClient.chatCompletion.mockResolvedValueOnce({
        content: 'Test decision',
        toolCalls: [],
      });

      await decisionEngine.makeDecision(agentState, []);

      expect(mockContextManager.addUserMessage).toHaveBeenCalledWith(
        expect.stringContaining('Test Product: scaling, margin 66.7%, content score 80, proceed')
      );
    });
  });
});