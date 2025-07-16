import { describe, it, expect, beforeEach } from 'vitest';
import { DropshippingAgent } from '../agent/DropshippingAgent.js';
import { DropshippingSimulation } from '../simulation/DropshippingSimulation.js';
import { Product } from '../models/Product.js';
import { Campaign } from '../models/Campaign.js';
import { AgentMemory } from '../memory/AgentMemory.js';
import { ContextManager } from '../agent/ContextManager.js';
import { performance } from 'perf_hooks';

describe('Performance Benchmarks Integration Tests', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.GROK_API_KEY = 'test-grok-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  describe('Decision Making Performance', () => {
    it('should make decisions within 2 seconds on average', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 1000,
        testMode: true
      });

      const decisionTimes = [];
      const decisions = [
        { type: 'PRODUCT_RESEARCH', context: 'Need new winning products' },
        { type: 'CAMPAIGN_CREATION', context: 'Have budget for new campaigns' },
        { type: 'CAMPAIGN_OPTIMIZATION', context: 'Existing campaigns need review' },
        { type: 'BUDGET_ALLOCATION', context: 'Distribute available capital' },
        { type: 'MARKET_ANALYSIS', context: 'Analyze current trends' }
      ];

      for (const decision of decisions) {
        const startTime = performance.now();
        
        const result = await agent.makeDecision({
          context: decision.context,
          options: ['proceed', 'wait', 'skip'],
          urgency: 'normal'
        });
        
        const endTime = performance.now();
        const decisionTime = endTime - startTime;
        decisionTimes.push(decisionTime);

        expect(result).toBeDefined();
        expect(result.decision).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
      }

      const avgDecisionTime = decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length;
      const maxDecisionTime = Math.max(...decisionTimes);

      console.log(`Average decision time: ${avgDecisionTime.toFixed(2)}ms`);
      console.log(`Max decision time: ${maxDecisionTime.toFixed(2)}ms`);

      expect(avgDecisionTime).toBeLessThan(2000); // Under 2 seconds average
      expect(maxDecisionTime).toBeLessThan(5000); // No decision over 5 seconds
    });
  });

  describe('Memory System Performance', () => {
    it('should handle 10,000 memory entries efficiently', async () => {
      const memory = new AgentMemory();
      const entryCount = 10000;
      
      // Measure write performance
      const writeStartTime = performance.now();
      
      for (let i = 0; i < entryCount; i++) {
        await memory.remember({
          type: ['decision', 'metric', 'insight'][i % 3],
          content: `Test memory entry ${i} with some content about campaigns and products`,
          metadata: {
            importance: Math.random(),
            category: ['product', 'campaign', 'financial'][i % 3],
            timestamp: new Date(Date.now() - i * 60000) // Stagger timestamps
          }
        });
      }
      
      const writeEndTime = performance.now();
      const totalWriteTime = writeEndTime - writeStartTime;
      const avgWriteTime = totalWriteTime / entryCount;

      console.log(`Total write time for ${entryCount} entries: ${totalWriteTime.toFixed(2)}ms`);
      console.log(`Average write time per entry: ${avgWriteTime.toFixed(2)}ms`);

      expect(avgWriteTime).toBeLessThan(1); // Under 1ms per write

      // Measure search performance
      const searchQueries = [
        'campaign performance',
        'product analysis',
        'financial metrics',
        'winning products',
        'failed campaigns'
      ];

      const searchTimes = [];

      for (const query of searchQueries) {
        const searchStartTime = performance.now();
        const results = await memory.search(query, 100);
        const searchEndTime = performance.now();
        
        searchTimes.push(searchEndTime - searchStartTime);
        expect(results.length).toBeGreaterThan(0);
      }

      const avgSearchTime = searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length;
      
      console.log(`Average search time: ${avgSearchTime.toFixed(2)}ms`);
      expect(avgSearchTime).toBeLessThan(100); // Under 100ms per search

      // Measure pruning performance
      const pruneStartTime = performance.now();
      const prunedCount = await memory.pruneOldEntries(30);
      const pruneEndTime = performance.now();
      
      console.log(`Pruning time: ${(pruneEndTime - pruneStartTime).toFixed(2)}ms`);
      console.log(`Pruned ${prunedCount} entries`);
      
      expect(pruneEndTime - pruneStartTime).toBeLessThan(500); // Under 500ms to prune
    });
  });

  describe('Campaign Management Performance', () => {
    it('should handle 100 concurrent campaigns efficiently', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 10000,
        testMode: true
      });

      const campaignCount = 100;
      const campaigns = [];

      // Create products
      const createProductsStartTime = performance.now();
      
      for (let i = 0; i < campaignCount; i++) {
        const product = new Product({
          id: `perf_prod_${i}`,
          name: `Performance Test Product ${i}`,
          price: 20 + Math.random() * 30,
          cost: 5 + Math.random() * 10,
          supplier: 'TestSupplier',
          category: 'Performance',
          images: ['test.jpg'],
          description: 'Performance test product',
          shippingTime: '5-7 days',
          minimumOrder: 1
        });
        
        agent.getState().products.set(product.id, product);
      }
      
      const createProductsEndTime = performance.now();
      console.log(`Product creation time: ${(createProductsEndTime - createProductsStartTime).toFixed(2)}ms`);

      // Create campaigns
      const createCampaignsStartTime = performance.now();
      
      for (let i = 0; i < campaignCount; i++) {
        const campaign = new Campaign({
          id: `perf_camp_${i}`,
          productId: `perf_prod_${i}`,
          platform: ['facebook', 'tiktok', 'google'][i % 3],
          budget: 50,
          status: 'active',
          startDate: new Date(),
          targetAudience: {
            ageMin: 25,
            ageMax: 45,
            interests: ['technology'],
            countries: ['US']
          }
        });
        
        agent.getState().campaigns.set(campaign.id, campaign);
        campaigns.push(campaign);
      }
      
      const createCampaignsEndTime = performance.now();
      console.log(`Campaign creation time: ${(createCampaignsEndTime - createCampaignsStartTime).toFixed(2)}ms`);

      // Update all campaign metrics
      const updateMetricsStartTime = performance.now();
      
      for (const campaign of campaigns) {
        campaign.impressions = Math.floor(Math.random() * 10000);
        campaign.clicks = Math.floor(campaign.impressions * 0.05);
        campaign.conversions = Math.floor(campaign.clicks * 0.1);
        campaign.spend = campaign.budget * Math.random();
        campaign.revenue = campaign.conversions * 45;
        campaign.updateMetrics();
      }
      
      const updateMetricsEndTime = performance.now();
      console.log(`Metrics update time: ${(updateMetricsEndTime - updateMetricsStartTime).toFixed(2)}ms`);

      // Analyze all campaigns
      const analyzeStartTime = performance.now();
      
      const analysis = agent.analyzeCampaignPerformance();
      
      const analyzeEndTime = performance.now();
      console.log(`Analysis time for ${campaignCount} campaigns: ${(analyzeEndTime - analyzeStartTime).toFixed(2)}ms`);

      expect(analyzeEndTime - analyzeStartTime).toBeLessThan(100); // Under 100ms to analyze

      // Kill underperforming campaigns
      const killStartTime = performance.now();
      
      let killedCount = 0;
      for (const campaign of campaigns) {
        if (campaign.roas < 1.0) {
          campaign.status = 'killed';
          killedCount++;
        }
      }
      
      const killEndTime = performance.now();
      console.log(`Killed ${killedCount} campaigns in ${(killEndTime - killStartTime).toFixed(2)}ms`);

      expect(killEndTime - killStartTime).toBeLessThan(50); // Under 50ms to process
    });
  });

  describe('Context Management Performance', () => {
    it('should efficiently manage 30,000 token context window', async () => {
      const contextManager = new ContextManager();
      
      // Generate large messages to fill context
      const largeMessages = [];
      const messageSize = 1000; // Approximate tokens per message
      const messageCount = 40; // Total ~40,000 tokens

      const addMessagesStartTime = performance.now();
      
      for (let i = 0; i < messageCount; i++) {
        const message = {
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `This is message ${i} with substantial content `.repeat(50) + 
                  `containing information about campaigns, products, metrics, and decisions.`
        };
        
        contextManager.addMessage(message);
        largeMessages.push(message);
      }
      
      const addMessagesEndTime = performance.now();
      console.log(`Added ${messageCount} messages in ${(addMessagesEndTime - addMessagesStartTime).toFixed(2)}ms`);

      // Measure pruning performance
      const pruneStartTime = performance.now();
      
      const contextSize = contextManager.getContextSize();
      const prunedContext = contextManager.getContext();
      
      const pruneEndTime = performance.now();
      console.log(`Context pruning time: ${(pruneEndTime - pruneStartTime).toFixed(2)}ms`);
      console.log(`Context size: ${contextSize} tokens`);

      expect(contextSize).toBeLessThanOrEqual(30000);
      expect(pruneEndTime - pruneStartTime).toBeLessThan(100); // Under 100ms to prune

      // Measure search within context
      const searchStartTime = performance.now();
      
      const relevantMessages = contextManager.findRelevantMessages('campaign metrics');
      
      const searchEndTime = performance.now();
      console.log(`Context search time: ${(searchEndTime - searchStartTime).toFixed(2)}ms`);
      
      expect(searchEndTime - searchStartTime).toBeLessThan(50); // Under 50ms to search
      expect(relevantMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Full Simulation Performance', () => {
    it('should complete a 30-day simulation within reasonable time', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 5000,
        maxDays: 30,
        autoStart: false,
        testMode: true
      });

      const simulationStartTime = performance.now();
      
      await simulation.start();
      
      const dayTimes = [];
      
      while (simulation.getState().status === 'running' && simulation.getState().day < 30) {
        const dayStartTime = performance.now();
        
        await simulation.simulateDay();
        
        const dayEndTime = performance.now();
        dayTimes.push(dayEndTime - dayStartTime);
      }
      
      const simulationEndTime = performance.now();
      const totalSimulationTime = simulationEndTime - simulationStartTime;
      const avgDayTime = dayTimes.reduce((a, b) => a + b, 0) / dayTimes.length;

      console.log(`Total simulation time for ${simulation.getState().day} days: ${totalSimulationTime.toFixed(2)}ms`);
      console.log(`Average time per simulated day: ${avgDayTime.toFixed(2)}ms`);
      console.log(`Max day simulation time: ${Math.max(...dayTimes).toFixed(2)}ms`);

      expect(avgDayTime).toBeLessThan(5000); // Under 5 seconds per day average
      expect(totalSimulationTime).toBeLessThan(150000); // Under 2.5 minutes for 30 days

      // Verify simulation completed successfully
      const finalState = simulation.getState();
      expect(['completed', 'bankrupt']).toContain(finalState.status);
      expect(finalState.day).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple simultaneous operations efficiently', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 5000,
        testMode: true
      });

      const concurrentStartTime = performance.now();
      
      // Execute multiple operations concurrently
      const operations = await Promise.all([
        // Product research
        agent.executeAction({
          type: 'RESEARCH_PRODUCTS',
          parameters: { category: 'Electronics', limit: 20 }
        }),
        
        // Campaign creation
        agent.executeAction({
          type: 'CREATE_CAMPAIGN',
          parameters: {
            productId: 'test_prod_1',
            platform: 'facebook',
            budget: 100
          }
        }),
        
        // Memory search
        agent.searchMemories('winning products'),
        
        // Financial analysis
        agent.analyzeFinancialHealth(),
        
        // Campaign metrics check
        agent.executeAction({
          type: 'CHECK_METRICS',
          parameters: { timeframe: 'last_7_days' }
        })
      ]);
      
      const concurrentEndTime = performance.now();
      const totalConcurrentTime = concurrentEndTime - concurrentStartTime;

      console.log(`Concurrent operations completed in: ${totalConcurrentTime.toFixed(2)}ms`);

      // All operations should complete
      operations.forEach(op => {
        expect(op).toBeDefined();
      });

      // Should be faster than sequential execution
      expect(totalConcurrentTime).toBeLessThan(10000); // Under 10 seconds for all

      // Now execute sequentially for comparison
      const sequentialStartTime = performance.now();
      
      await agent.executeAction({
        type: 'RESEARCH_PRODUCTS',
        parameters: { category: 'Electronics', limit: 20 }
      });
      
      await agent.executeAction({
        type: 'CREATE_CAMPAIGN',
        parameters: {
          productId: 'test_prod_2',
          platform: 'tiktok',
          budget: 100
        }
      });
      
      await agent.searchMemories('winning products');
      await agent.analyzeFinancialHealth();
      
      await agent.executeAction({
        type: 'CHECK_METRICS',
        parameters: { timeframe: 'last_7_days' }
      });
      
      const sequentialEndTime = performance.now();
      const totalSequentialTime = sequentialEndTime - sequentialStartTime;

      console.log(`Sequential operations completed in: ${totalSequentialTime.toFixed(2)}ms`);
      console.log(`Speedup from concurrent execution: ${(totalSequentialTime / totalConcurrentTime).toFixed(2)}x`);

      // Concurrent should be faster
      expect(totalConcurrentTime).toBeLessThan(totalSequentialTime);
    });
  });
});