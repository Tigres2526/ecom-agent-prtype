import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DropshippingSimulation } from '../simulation/DropshippingSimulation.js';
import { DropshippingAgent } from '../agent/DropshippingAgent.js';
import { FinancialTracker } from '../agent/FinancialTracker.js';
import { LoggingService } from '../logging/LoggingService.js';
import path from 'path';
import fs from 'fs';

describe('Bankruptcy Scenarios Integration Tests', () => {
  let loggingService: LoggingService;
  const testDir = path.join(process.cwd(), 'test-bankruptcy');

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.GROK_API_KEY = 'test-grok-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    // Initialize logging
    loggingService = LoggingService.getInstance({
      logDir: path.join(testDir, 'logs'),
      auditDir: path.join(testDir, 'audit'),
      enableConsole: false
    });
  });

  afterEach(() => {
    loggingService.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Slow Bankruptcy Progression', () => {
    it('should detect and handle gradual capital depletion', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 300,
        maxDays: 50,
        autoStart: false,
        testMode: true,
        loggingService: loggingService
      });

      // Mock consistently poor performance
      vi.spyOn(simulation, 'generateMockMetrics').mockReturnValue({
        impressions: 500,
        clicks: 10,
        conversions: 0,
        spend: 15,
        revenue: 0,
        ctr: 0.02,
        cpc: 1.5,
        roas: 0
      });

      await simulation.start();

      const financialHistory = [];
      let bankruptcyDetected = false;
      let consecutiveNegativeDays = 0;

      while (simulation.getState().status === 'running' && simulation.getState().day < 50) {
        const beforeNetWorth = simulation.getState().netWorth;
        await simulation.simulateDay();
        const afterNetWorth = simulation.getState().netWorth;

        financialHistory.push({
          day: simulation.getState().day,
          netWorth: afterNetWorth,
          dailyChange: afterNetWorth - beforeNetWorth,
          isNegative: afterNetWorth < 0
        });

        if (afterNetWorth < 0) {
          consecutiveNegativeDays++;
          if (consecutiveNegativeDays >= 10 && !bankruptcyDetected) {
            bankruptcyDetected = true;
          }
        } else {
          consecutiveNegativeDays = 0;
        }
      }

      const finalState = simulation.getState();

      expect(finalState.status).toBe('bankrupt');
      expect(bankruptcyDetected).toBe(true);
      expect(finalState.bankruptcyDay).toBeDefined();
      expect(finalState.bankruptcyDay).toBeGreaterThan(10);

      // Verify proper logging of bankruptcy
      const auditFiles = fs.readdirSync(path.join(testDir, 'audit'));
      expect(auditFiles.length).toBeGreaterThan(0);
      
      const auditContent = fs.readFileSync(
        path.join(testDir, 'audit', auditFiles[0]), 
        'utf-8'
      );
      expect(auditContent).toContain('BANKRUPTCY');
    });
  });

  describe('Rapid Bankruptcy from High-Risk Campaigns', () => {
    it('should handle sudden capital loss from failed campaigns', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 500,
        testMode: true
      });

      // Create multiple high-budget campaigns
      const campaigns = [];
      for (let i = 0; i < 5; i++) {
        const result = await agent.executeAction({
          type: 'CREATE_CAMPAIGN',
          parameters: {
            productId: `high_risk_${i}`,
            platform: 'facebook',
            budget: 80 // High budget relative to capital
          }
        });
        
        if (result.success) {
          campaigns.push(result.data.campaign);
        }
      }

      // Simulate all campaigns failing
      for (const campaign of campaigns) {
        campaign.spend = campaign.budget;
        campaign.revenue = 0;
        campaign.roas = 0;
        campaign.conversions = 0;
      }

      // Update financial state
      const financialTracker = new FinancialTracker(agent.getState());
      campaigns.forEach(campaign => {
        financialTracker.recordExpense(campaign.spend, 'campaign', campaign.id);
      });

      const isBankrupt = financialTracker.checkBankruptcy();
      
      expect(agent.getState().netWorth).toBeLessThan(0);
      expect(isBankrupt).toBe(false); // Not bankrupt yet (less than 10 days negative)
      
      // Simulate 10 more days with negative balance
      for (let i = 0; i < 10; i++) {
        financialTracker.deductDailyFee();
      }
      
      const nowBankrupt = financialTracker.checkBankruptcy();
      expect(nowBankrupt).toBe(true);
    });
  });

  describe('Near-Bankruptcy Recovery', () => {
    it('should recover from near-bankruptcy with successful campaigns', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 200,
        maxDays: 30,
        autoStart: false,
        testMode: true
      });

      let phase = 'decline';
      let dayCount = 0;

      // Mock recovery scenario
      const mockRecoveryMetrics = vi.fn().mockImplementation(() => {
        dayCount++;
        
        // Switch to recovery phase when nearly bankrupt
        if (simulation.getState().netWorth < 50 && phase === 'decline') {
          phase = 'recovery';
        }

        if (phase === 'decline') {
          return {
            impressions: 300,
            clicks: 5,
            conversions: 0,
            spend: 20,
            revenue: 0,
            ctr: 0.017,
            cpc: 4.0,
            roas: 0
          };
        } else {
          // Recovery phase - better performance
          return {
            impressions: 1000,
            clicks: 50,
            conversions: 5,
            spend: 10,
            revenue: 100,
            ctr: 0.05,
            cpc: 0.20,
            roas: 10
          };
        }
      });

      vi.spyOn(simulation, 'generateMockMetrics').mockImplementation(mockRecoveryMetrics);

      await simulation.start();

      let lowestNetWorth = simulation.getState().netWorth;
      let recoveryStartDay = null;

      while (simulation.getState().status === 'running' && simulation.getState().day < 30) {
        await simulation.simulateDay();
        
        const currentNetWorth = simulation.getState().netWorth;
        
        if (currentNetWorth < lowestNetWorth) {
          lowestNetWorth = currentNetWorth;
        }
        
        if (phase === 'recovery' && !recoveryStartDay) {
          recoveryStartDay = simulation.getState().day;
        }
      }

      const finalState = simulation.getState();
      
      expect(finalState.status).toBe('completed');
      expect(lowestNetWorth).toBeLessThan(50);
      expect(finalState.netWorth).toBeGreaterThan(lowestNetWorth);
      expect(recoveryStartDay).toBeDefined();
    });
  });

  describe('Multiple Bankruptcy Factors', () => {
    it('should handle compound factors leading to bankruptcy', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 400,
        maxDays: 40,
        autoStart: false,
        testMode: true
      });

      let errorCount = 0;
      const factors = {
        poorCampaigns: true,
        highFees: true,
        apiErrors: true,
        lowInventory: true
      };

      // Mock multiple failure factors
      const mockCompoundFailureMetrics = vi.fn().mockImplementation(() => {
        // Simulate API errors occasionally
        if (factors.apiErrors && Math.random() > 0.8) {
          errorCount++;
          throw new Error('API rate limit exceeded');
        }

        // Poor campaign performance
        if (factors.poorCampaigns) {
          return {
            impressions: 200,
            clicks: 2,
            conversions: 0,
            spend: 25,
            revenue: 0,
            ctr: 0.01,
            cpc: 12.5,
            roas: 0
          };
        }

        return {
          impressions: 1000,
          clicks: 50,
          conversions: 3,
          spend: 20,
          revenue: 60,
          ctr: 0.05,
          cpc: 0.40,
          roas: 3
        };
      });

      vi.spyOn(simulation, 'generateMockMetrics').mockImplementation(mockCompoundFailureMetrics);

      // Add additional daily fees
      const originalDeductFee = simulation.deductDailyFee;
      simulation.deductDailyFee = function() {
        originalDeductFee.call(this);
        if (factors.highFees) {
          // Additional platform fees
          this.getState().netWorth -= 10;
        }
      };

      await simulation.start();

      const problemsEncountered = {
        apiErrors: 0,
        negativeDays: 0,
        failedCampaigns: 0
      };

      while (simulation.getState().status === 'running' && simulation.getState().day < 40) {
        try {
          await simulation.simulateDay();
        } catch (error) {
          problemsEncountered.apiErrors++;
        }

        if (simulation.getState().netWorth < 0) {
          problemsEncountered.negativeDays++;
        }

        const failedCampaigns = Array.from(simulation.getState().campaigns.values())
          .filter(c => c.status === 'killed' && c.roas < 1).length;
        problemsEncountered.failedCampaigns = failedCampaigns;
      }

      const finalState = simulation.getState();
      
      expect(finalState.status).toBe('bankrupt');
      expect(problemsEncountered.apiErrors).toBeGreaterThan(0);
      expect(problemsEncountered.negativeDays).toBeGreaterThan(10);
      expect(problemsEncountered.failedCampaigns).toBeGreaterThan(0);
    });
  });

  describe('Bankruptcy Prevention Strategies', () => {
    it('should activate conservative mode when approaching bankruptcy', async () => {
      const agent = new DropshippingAgent({
        initialCapital: 300,
        testMode: true
      });

      const financialTracker = new FinancialTracker(agent.getState());
      
      // Simulate losses bringing balance near zero
      agent.getState().netWorth = 80;
      
      // Check if conservative strategies activate
      const isConservativeMode = financialTracker.shouldBeConservative();
      expect(isConservativeMode).toBe(true);

      // Try to create expensive campaign
      const result = await agent.executeAction({
        type: 'CREATE_CAMPAIGN',
        parameters: {
          productId: 'test_product',
          platform: 'facebook',
          budget: 100 // More than available
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient');

      // Should only allow small budget campaigns
      const smallBudgetResult = await agent.executeAction({
        type: 'CREATE_CAMPAIGN',
        parameters: {
          productId: 'test_product',
          platform: 'facebook',
          budget: 10 // Conservative budget
        }
      });

      expect(smallBudgetResult.success).toBe(true);
    });
  });

  describe('Post-Bankruptcy Analysis', () => {
    it('should generate comprehensive bankruptcy report', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 150,
        maxDays: 30,
        autoStart: false,
        testMode: true,
        loggingService: loggingService
      });

      // Force bankruptcy scenario
      vi.spyOn(simulation, 'generateMockMetrics').mockReturnValue({
        impressions: 100,
        clicks: 1,
        conversions: 0,
        spend: 30,
        revenue: 0,
        ctr: 0.01,
        cpc: 30,
        roas: 0
      });

      await simulation.start();

      // Run until bankruptcy
      while (simulation.getState().status === 'running') {
        await simulation.simulateDay();
      }

      const finalState = simulation.getState();
      expect(finalState.status).toBe('bankrupt');

      // Generate bankruptcy report
      const report = simulation.generateFinalReport();
      
      expect(report).toBeDefined();
      expect(report.bankruptcyAnalysis).toBeDefined();
      expect(report.bankruptcyAnalysis.day).toBe(finalState.bankruptcyDay);
      expect(report.bankruptcyAnalysis.finalNetWorth).toBeLessThan(0);
      expect(report.bankruptcyAnalysis.primaryCauses).toBeDefined();
      expect(report.bankruptcyAnalysis.primaryCauses).toContain('Poor campaign performance');

      // Verify audit trail captured bankruptcy
      await loggingService.audit.closeAndWait();
      
      const auditReport = await loggingService.audit.generateReport(
        new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        new Date()
      );
      
      expect(auditReport.byAction['SYSTEM_BANKRUPTCY']).toBeGreaterThan(0);
    });
  });
});