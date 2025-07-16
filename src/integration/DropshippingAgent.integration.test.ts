import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DropshippingAgent } from '../agent/DropshippingAgent.js';
import { DropshippingSimulation } from '../simulation/DropshippingSimulation.js';
import { AgentState } from '../models/AgentState.js';
import { Product } from '../models/Product.js';
import { Campaign } from '../models/Campaign.js';
import { LoggingService } from '../logging/LoggingService.js';
import fs from 'fs';
import path from 'path';

describe('DropshippingAgent End-to-End Integration Tests', () => {
  let simulation: DropshippingSimulation;
  let loggingService: LoggingService;
  const testDir = path.join(process.cwd(), 'test-integration');
  
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    // Initialize logging service
    loggingService = LoggingService.getInstance({
      logDir: path.join(testDir, 'logs'),
      auditDir: path.join(testDir, 'audit'),
      enableConsole: false,
      enableFile: true
    });
    
    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.GROK_API_KEY = 'test-grok-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });
  
  afterEach(() => {
    loggingService.close();
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  describe('Complete Simulation Lifecycle', () => {
    it('should initialize and run a complete simulation', async () => {
      // Create simulation with test configuration
      simulation = new DropshippingSimulation({
        initialCapital: 500,
        maxDays: 5,
        autoStart: false,
        testMode: true
      });
      
      // Verify initial state
      expect(simulation.getState().day).toBe(0);
      expect(simulation.getState().netWorth).toBe(500);
      expect(simulation.getState().status).toBe('ready');
      
      // Start simulation
      await simulation.start();
      
      expect(simulation.getState().status).toBe('running');
      expect(simulation.getState().day).toBeGreaterThan(0);
      
      // Wait for simulation to complete or timeout
      const maxWaitTime = 30000; // 30 seconds
      const startTime = Date.now();
      
      while (simulation.getState().status === 'running' && 
             Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const finalState = simulation.getState();
      expect(['completed', 'bankrupt', 'stopped']).toContain(finalState.status);
      
      // Verify logs were created
      const logFiles = fs.readdirSync(path.join(testDir, 'logs'));
      expect(logFiles.length).toBeGreaterThan(0);
      
      // Verify audit trail was created
      const auditFiles = fs.readdirSync(path.join(testDir, 'audit'));
      expect(auditFiles.length).toBeGreaterThan(0);
    });
  });
  
  describe('Product Research Workflow', () => {
    it('should find and analyze products successfully', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 500,
        testMode: true
      });
      
      // Mock product research results
      const mockProducts = [
        {
          id: 'prod_1',
          name: 'Wireless Earbuds',
          price: 29.99,
          cost: 12.00,
          supplier: 'AliExpress',
          category: 'Electronics',
          images: ['image1.jpg'],
          description: 'High quality wireless earbuds',
          shippingTime: '7-14 days',
          minimumOrder: 1,
          competitorCount: 5,
          averageRating: 4.5,
          monthlySearchVolume: 10000
        }
      ];
      
      // Execute product research
      const searchResult = await agent.executeAction({
        type: 'RESEARCH_PRODUCTS',
        parameters: {
          category: 'Electronics',
          priceRange: { min: 10, max: 50 },
          minMargin: 0.5
        }
      });
      
      expect(searchResult.success).toBe(true);
      expect(searchResult.data.products).toBeDefined();
      
      // Analyze a product
      const analyzeResult = await agent.executeAction({
        type: 'ANALYZE_PRODUCT',
        parameters: {
          productId: 'prod_1'
        }
      });
      
      expect(analyzeResult.success).toBe(true);
      expect(analyzeResult.data.analysis).toBeDefined();
      expect(analyzeResult.data.analysis.marginPercentage).toBeGreaterThan(0.5);
    });
  });
  
  describe('Campaign Management Workflow', () => {
    it('should create, monitor, and optimize campaigns', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 500,
        testMode: true
      });
      
      // Create a test product
      const product = new Product({
        id: 'test_prod_1',
        name: 'Test Product',
        price: 39.99,
        cost: 15.00,
        supplier: 'TestSupplier',
        category: 'Test',
        images: ['test.jpg'],
        description: 'Test product for integration testing',
        shippingTime: '5-7 days',
        minimumOrder: 1
      });
      
      agent.getState().products.set(product.id, product);
      
      // Create campaign
      const createResult = await agent.executeAction({
        type: 'CREATE_CAMPAIGN',
        parameters: {
          productId: product.id,
          platform: 'facebook',
          budget: 50,
          audience: {
            ageMin: 25,
            ageMax: 45,
            interests: ['technology', 'gadgets'],
            countries: ['US']
          }
        }
      });
      
      expect(createResult.success).toBe(true);
      expect(createResult.data.campaign).toBeDefined();
      
      const campaignId = createResult.data.campaign.id;
      
      // Check campaign metrics
      const metricsResult = await agent.executeAction({
        type: 'CHECK_METRICS',
        parameters: {
          campaignId: campaignId
        }
      });
      
      expect(metricsResult.success).toBe(true);
      expect(metricsResult.data.metrics).toBeDefined();
      
      // Scale or kill based on performance
      const campaign = agent.getState().campaigns.get(campaignId);
      if (campaign && campaign.roas > 1.5) {
        const scaleResult = await agent.executeAction({
          type: 'SCALE_CAMPAIGN',
          parameters: {
            campaignId: campaignId,
            newBudget: 100
          }
        });
        
        expect(scaleResult.success).toBe(true);
      } else {
        const killResult = await agent.executeAction({
          type: 'KILL_CAMPAIGN',
          parameters: {
            campaignId: campaignId,
            reason: 'Poor performance in test'
          }
        });
        
        expect(killResult.success).toBe(true);
      }
    });
  });
  
  describe('Financial Management and Bankruptcy Protection', () => {
    it('should handle financial constraints and prevent bankruptcy', async () => {
      // Create agent with very limited capital
      const agent = new DropshippingAgent({
        initialCapital: 100,
        testMode: true
      });
      
      // Try to create expensive campaigns
      const result1 = await agent.executeAction({
        type: 'CREATE_CAMPAIGN',
        parameters: {
          productId: 'test_prod',
          platform: 'facebook',
          budget: 80 // 80% of capital
        }
      });
      
      // Should succeed but leave little capital
      expect(result1.success).toBe(true);
      
      // Try to create another expensive campaign
      const result2 = await agent.executeAction({
        type: 'CREATE_CAMPAIGN',
        parameters: {
          productId: 'test_prod_2',
          platform: 'tiktok',
          budget: 50 // Would exceed available capital
        }
      });
      
      // Should fail due to insufficient funds
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Insufficient');
      
      // Verify financial tracking
      const state = agent.getState();
      expect(state.netWorth).toBeLessThan(100);
      expect(state.totalSpend).toBeGreaterThan(0);
    });
    
    it('should detect and handle bankruptcy conditions', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 50,
        testMode: true
      });
      
      // Simulate daily fees over multiple days
      for (let i = 0; i < 15; i++) {
        agent.getState().netWorth -= 5; // Simulate $5 daily fee
        
        const isBankrupt = agent.checkBankruptcy();
        
        if (agent.getState().netWorth < 0 && i >= 10) {
          expect(isBankrupt).toBe(true);
          break;
        }
      }
    });
  });
  
  describe('Error Recovery and Circuit Breaker', () => {
    it('should handle and recover from API errors', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 500,
        testMode: true
      });
      
      // Mock API failure
      const mockError = new Error('API rate limit exceeded');
      vi.spyOn(agent, 'executeAction').mockRejectedValueOnce(mockError);
      
      // Attempt action that will fail
      const result = await agent.executeAction({
        type: 'RESEARCH_PRODUCTS',
        parameters: { category: 'Electronics' }
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
      
      // Verify circuit breaker activated
      const errorState = agent.getErrorState();
      expect(errorState.isInRecoveryMode).toBe(true);
      
      // Verify recovery strategy
      expect(errorState.strategy).toContain('conservative');
    });
  });
  
  describe('Memory System Integration', () => {
    it('should store and retrieve memories correctly', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 500,
        testMode: true
      });
      
      // Store different types of memories
      await agent.storeMemory({
        type: 'decision',
        content: 'Decided to focus on electronics category',
        metadata: { confidence: 0.85 }
      });
      
      await agent.storeMemory({
        type: 'insight',
        content: 'Facebook ads perform better on weekends',
        metadata: { platform: 'facebook' }
      });
      
      // Search memories
      const searchResults = await agent.searchMemories('electronics');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].content).toContain('electronics');
      
      // Test memory pruning
      const oldMemory = {
        type: 'metric',
        content: 'Old campaign data',
        timestamp: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000) // 35 days old
      };
      
      await agent.storeMemory(oldMemory);
      await agent.pruneOldMemories();
      
      const afterPruning = await agent.searchMemories('Old campaign');
      expect(afterPruning.length).toBe(0);
    });
  });
  
  describe('Multi-Day Simulation Scenarios', () => {
    it('should handle a successful 10-day simulation', async () => {
      simulation = new DropshippingSimulation({
        initialCapital: 1000,
        maxDays: 10,
        autoStart: false,
        testMode: true
      });
      
      // Mock successful campaign performance
      vi.spyOn(simulation, 'generateMockMetrics').mockReturnValue({
        impressions: 1000,
        clicks: 50,
        conversions: 5,
        spend: 20,
        revenue: 150,
        ctr: 0.05,
        cpc: 0.40,
        roas: 7.5
      });
      
      await simulation.start();
      
      // Fast forward simulation
      while (simulation.getState().status === 'running' && 
             simulation.getState().day < 10) {
        await simulation.simulateDay();
      }
      
      const finalState = simulation.getState();
      expect(finalState.day).toBe(10);
      expect(finalState.status).toBe('completed');
      expect(finalState.netWorth).toBeGreaterThan(1000); // Should be profitable
      expect(finalState.totalRevenue).toBeGreaterThan(0);
      expect(finalState.successfulCampaigns).toBeGreaterThan(0);
    });
    
    it('should handle a bankruptcy scenario correctly', async () => {
      simulation = new DropshippingSimulation({
        initialCapital: 100,
        maxDays: 30,
        autoStart: false,
        testMode: true
      });
      
      // Mock poor campaign performance
      vi.spyOn(simulation, 'generateMockMetrics').mockReturnValue({
        impressions: 100,
        clicks: 2,
        conversions: 0,
        spend: 20,
        revenue: 0,
        ctr: 0.02,
        cpc: 10.0,
        roas: 0
      });
      
      await simulation.start();
      
      // Fast forward until bankruptcy
      while (simulation.getState().status === 'running') {
        await simulation.simulateDay();
        
        if (simulation.getState().netWorth < -50) {
          break; // Should trigger bankruptcy
        }
      }
      
      expect(simulation.getState().status).toBe('bankrupt');
      expect(simulation.getState().bankruptcyDay).toBeDefined();
    });
  });
  
  describe('Performance Benchmarks', () => {
    it('should make decisions within acceptable time limits', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 500,
        testMode: true
      });
      
      const startTime = Date.now();
      
      // Execute multiple decisions
      const decisions = [];
      for (let i = 0; i < 10; i++) {
        const decision = await agent.makeDecision({
          context: 'Should I research new products?',
          options: ['yes', 'no'],
          factors: ['current inventory', 'market trends', 'available capital']
        });
        decisions.push(decision);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / decisions.length;
      
      // Average decision time should be under 2 seconds
      expect(avgTime).toBeLessThan(2000);
      
      // All decisions should have confidence scores
      decisions.forEach(decision => {
        expect(decision.confidence).toBeGreaterThan(0);
        expect(decision.confidence).toBeLessThanOrEqual(1);
      });
    });
    
    it('should handle high-volume operations efficiently', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 5000,
        testMode: true
      });
      
      const startTime = Date.now();
      
      // Create multiple products
      const products = [];
      for (let i = 0; i < 50; i++) {
        const product = new Product({
          id: `perf_test_${i}`,
          name: `Test Product ${i}`,
          price: 20 + Math.random() * 80,
          cost: 10 + Math.random() * 30,
          supplier: 'TestSupplier',
          category: 'Performance',
          images: ['test.jpg'],
          description: 'Performance test product',
          shippingTime: '5-7 days',
          minimumOrder: 1
        });
        products.push(product);
        agent.getState().products.set(product.id, product);
      }
      
      // Create campaigns for products
      const campaigns = [];
      for (let i = 0; i < 20; i++) {
        const result = await agent.executeAction({
          type: 'CREATE_CAMPAIGN',
          parameters: {
            productId: products[i].id,
            platform: ['facebook', 'tiktok', 'google'][i % 3],
            budget: 50
          }
        });
        if (result.success) {
          campaigns.push(result.data.campaign);
        }
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should handle 50 products and 20 campaigns in under 10 seconds
      expect(totalTime).toBeLessThan(10000);
      expect(campaigns.length).toBeGreaterThan(0);
    });
  });
  
  describe('Complete Agent Lifecycle with Monitoring', () => {
    it('should track all metrics throughout agent lifecycle', async () => {
      simulation = new DropshippingSimulation({
        initialCapital: 2000,
        maxDays: 5,
        autoStart: false,
        testMode: true,
        loggingService: loggingService
      });
      
      await simulation.start();
      
      // Run for a few days
      for (let i = 0; i < 3; i++) {
        await simulation.simulateDay();
      }
      
      // Get comprehensive metrics
      const status = loggingService.getStatus();
      
      // Verify logging metrics
      expect(status.logger.totalLogs).toBeGreaterThan(0);
      expect(status.logger.logsByLevel).toBeDefined();
      
      // Verify monitoring metrics
      expect(status.monitor).toBeDefined();
      expect(status.monitor.metrics).toBeDefined();
      
      // Verify audit trail
      expect(status.audit.initialized).toBe(true);
      
      // Verify alerts
      expect(status.alerts).toBeDefined();
      expect(Array.isArray(status.alerts)).toBe(true);
      
      // Stop simulation
      await simulation.stop();
      expect(simulation.getState().status).toBe('stopped');
    });
  });
});