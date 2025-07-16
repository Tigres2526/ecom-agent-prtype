// Mock environment variables before any imports
process.env.GROK_API_KEY = 'test-grok-api-key';
process.env.OPENAI_API_KEY = 'test-openai-api-key';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { AgentConfig } from '../types/index.js';

// Mock all dependencies before importing the agent
vi.mock('../config/environment.js', () => ({
  env: {
    GROK_API_KEY: 'test-grok-api-key',
    OPENAI_API_KEY: 'test-openai-api-key'
  }
}));

// Create mock constructors with proper instances
const mockAgentState = {
  currentDay: 1,
  netWorth: 1000,
  totalRevenue: 0,
  totalSpend: 0,
  currentROAS: 0,
  errorCount: 0,
  activeCampaigns: [],
  activeProducts: [],
  isBankrupt: vi.fn().mockReturnValue(false),
  hasExcessiveErrors: vi.fn().mockReturnValue(false),
  getFinancialHealth: vi.fn().mockReturnValue({
    status: 'healthy',
    netWorth: 1000,
    availableBudget: 500,
    daysUntilBankruptcy: null
  }),
  advanceDay: vi.fn(),
  addCampaign: vi.fn(),
  addProduct: vi.fn()
};

vi.mock('../models/AgentState.js', () => ({
  AgentState: vi.fn().mockImplementation(() => mockAgentState)
}));

vi.mock('./GrokClient.js', () => ({
  GrokClient: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('./DecisionEngine.js', () => ({
  DecisionEngine: vi.fn().mockImplementation(() => ({
    makeDecision: vi.fn()
  }))
}));

vi.mock('./ContextManager.js', () => ({
  ContextManager: vi.fn().mockImplementation(() => ({
    pruneOldMessages: vi.fn(),
    addToolResult: vi.fn()
  }))
}));

vi.mock('./ErrorRecovery.js', () => ({
  ErrorRecovery: vi.fn().mockImplementation(() => ({
    executeWithCircuitBreaker: vi.fn().mockImplementation(async (fn) => fn()),
    getRecoveryStatus: vi.fn().mockReturnValue({ recoveryMode: false }),
    recoverFromError: vi.fn().mockResolvedValue([])
  }))
}));

vi.mock('./FinancialTracker.js', () => ({
  FinancialTracker: vi.fn().mockImplementation(() => ({
    getDailyMetrics: vi.fn().mockReturnValue({
      netWorth: 1000,
      currentROAS: 2.0,
      activeCampaigns: 0,
      activeProducts: 0
    }),
    checkAlerts: vi.fn().mockReturnValue([]),
    killLosingCampaigns: vi.fn().mockReturnValue(0)
  }))
}));

vi.mock('../memory/AgentMemory.js', () => ({
  AgentMemory: vi.fn().mockImplementation(() => ({
    setMemory: vi.fn().mockResolvedValue(undefined),
    writeScratchpad: vi.fn(),
    storeVectorMemory: vi.fn().mockResolvedValue(undefined),
    pruneOldMemories: vi.fn(),
    logError: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../memory/VectorSearch.js', () => ({
  VectorSearch: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../memory/MemoryStore.js', () => ({
  MemoryStore: vi.fn().mockImplementation(() => ({
    writeScratchpad: vi.fn()
  }))
}));

vi.mock('../tools/ToolRegistry.js', () => ({
  ToolRegistry: vi.fn().mockImplementation(() => ({
    getAllTools: vi.fn().mockReturnValue([]),
    executeTool: vi.fn().mockResolvedValue({ success: true, data: {} })
  }))
}));

vi.mock('../tools/ProductResearchTools.js', () => ({
  ProductResearchTools: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../tools/CampaignManagementTools.js', () => ({
  CampaignManagementTools: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../tools/MarketingAngleTools.js', () => ({
  MarketingAngleTools: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../tools/MemoryTools.js', () => ({
  MemoryTools: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('../tools/AnalyticsTools.js', () => ({
  AnalyticsTools: vi.fn().mockImplementation(() => ({}))
}));

import { DropshippingAgent } from './DropshippingAgent.js';

describe('DropshippingAgent', () => {
  let agent: DropshippingAgent;
  let mockConfig: AgentConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset mockAgentState to default values
    mockAgentState.currentDay = 1;
    mockAgentState.netWorth = 1000;
    mockAgentState.totalRevenue = 0;
    mockAgentState.totalSpend = 0;
    mockAgentState.currentROAS = 0;
    mockAgentState.errorCount = 0;
    mockAgentState.activeCampaigns = [];
    mockAgentState.activeProducts = [];
    mockAgentState.isBankrupt.mockReturnValue(false);
    mockAgentState.hasExcessiveErrors.mockReturnValue(false);
    mockAgentState.getFinancialHealth.mockReturnValue({
      status: 'healthy',
      netWorth: 1000,
      availableBudget: 500,
      daysUntilBankruptcy: null
    });
    mockAgentState.advanceDay.mockClear();
    mockAgentState.addCampaign.mockClear();
    mockAgentState.addProduct.mockClear();
    
    // Configure test agent
    mockConfig = {
      initialCapital: 1000,
      dailyAdSpend: 50,
      targetROAS: 2.0,
      maxDays: 5, // Short test run
      maxContextTokens: 30000,
      maxActionsPerDay: 10,
      bankruptcyThreshold: 10
    };

    agent = new DropshippingAgent(mockConfig);
  });

  afterEach(() => {
    // Ensure agent is stopped
    agent.stop();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(agent).toBeDefined();
      
      // Get status to verify initialization
      const status = agent.getStatus();
      expect(status).toBeDefined();
      expect(status.isRunning).toBe(false);
      expect(status.isPaused).toBe(false);
    });

  });

  describe('Agent Control', () => {
    it('should pause and resume correctly', () => {
      let status = agent.getStatus();
      expect(status.isPaused).toBe(false);
      
      agent.pause();
      status = agent.getStatus();
      expect(status.isPaused).toBe(true);
      
      agent.resume();
      status = agent.getStatus();
      expect(status.isPaused).toBe(false);
    });

    it('should stop when requested', () => {
      agent.stop();
      const status = agent.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('Status Reporting', () => {
    it('should return comprehensive status', () => {
      const status = agent.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('isPaused');
      expect(status).toHaveProperty('currentDay');
      expect(status).toHaveProperty('netWorth');
      expect(status).toHaveProperty('currentROAS');
      expect(status).toHaveProperty('financialHealth');
      expect(status).toHaveProperty('errorCount');
      expect(status).toHaveProperty('activeCampaigns');
      expect(status).toHaveProperty('activeProducts');
    });
  });

  describe('Run Cycle', () => {
    it('should handle run cycle with mocked components', async () => {
      // Get mocked instances from vi mocks
      const { DecisionEngine } = await import('./DecisionEngine.js');
      const { FinancialTracker } = await import('./FinancialTracker.js');
      
      const mockDecisionEngine = (DecisionEngine as any).mock.results[0].value;
      mockDecisionEngine.makeDecision.mockResolvedValue({
        decision: 'No action needed',
        reasoning: 'All systems optimal',
        toolCalls: [],
        confidence: 0.9,
        expectedOutcome: 'Maintain current state',
        urgency: 'low'
      });

      // Configure day advancement
      mockAgentState.advanceDay.mockImplementation(function() {
        mockAgentState.currentDay++;
        if (mockAgentState.currentDay > mockConfig.maxDays) {
          agent.stop();
        }
      });

      // Spy on console methods
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a test that will stop after 2 days
      let dayCount = 0;
      mockAgentState.advanceDay.mockImplementation(function() {
        dayCount++;
        mockAgentState.currentDay = dayCount + 1;
        if (dayCount >= 2) {
          agent.stop();
        }
      });

      // Run the agent for a short test
      await agent.run();

      // Verify the agent ran through cycles
      expect(mockDecisionEngine.makeDecision).toHaveBeenCalled();
      expect(mockAgentState.advanceDay).toHaveBeenCalled();
      expect((FinancialTracker as any).mock.results[0].value.getDailyMetrics).toHaveBeenCalled();
      
      // Verify logging occurred
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Starting Dropshipping Agent'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Day 1 Starting'));
      
      // Restore console
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle bankruptcy correctly', async () => {
      // Override to bankrupt state
      mockAgentState.netWorth = -100;
      mockAgentState.isBankrupt.mockReturnValue(true);
      mockAgentState.getFinancialHealth.mockReturnValue({
        status: 'bankrupt',
        netWorth: -100,
        availableBudget: 0,
        daysUntilBankruptcy: 0
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Run the agent
      await agent.run();

      // Verify bankruptcy was detected
      expect(mockAgentState.isBankrupt).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Agent has gone bankrupt'));
      
      consoleLogSpy.mockRestore();
    });

    it('should execute tool calls when decisions include them', async () => {
      // Get mocked instances
      const { DecisionEngine } = await import('./DecisionEngine.js');
      const { ToolRegistry } = await import('../tools/ToolRegistry.js');
      
      const mockDecisionEngine = (DecisionEngine as any).mock.results[0].value;
      const mockToolRegistry = (ToolRegistry as any).mock.results[0].value;
      
      let callCount = 0;
      mockDecisionEngine.makeDecision.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            decision: 'Search for products',
            reasoning: 'Need to find products to sell',
            toolCalls: [{
              name: 'search_products',
              parameters: { query: 'trending' }
            }],
            confidence: 0.8,
            expectedOutcome: 'Find viable products',
            urgency: 'medium'
          });
        }
        return Promise.resolve({
          decision: 'No more actions',
          reasoning: 'Done for today',
          toolCalls: [],
          confidence: 0.9,
          expectedOutcome: 'Rest',
          urgency: 'low'
        });
      });

      mockToolRegistry.executeTool.mockResolvedValue({
        success: true,
        data: { products: [] }
      });

      // Configure to stop after one day
      mockAgentState.advanceDay.mockImplementation(() => {
        agent.stop();
      });

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Run the agent
      await agent.run();

      // Verify tool was executed
      expect(mockToolRegistry.executeTool).toHaveBeenCalledWith(
        'search_products',
        { query: 'trending' }
      );
      
      consoleLogSpy.mockRestore();
    });
  });
});