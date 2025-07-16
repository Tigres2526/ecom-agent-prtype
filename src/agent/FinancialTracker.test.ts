import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FinancialTracker } from './FinancialTracker.js';
import { AgentState } from '../models/AgentState.js';
import { Campaign } from '../models/Campaign.js';
import { Product } from '../models/Product.js';
import { v4 as uuidv4 } from 'uuid';

describe('FinancialTracker', () => {
  let financialTracker: FinancialTracker;
  let agentState: AgentState;

  beforeEach(() => {
    financialTracker = new FinancialTracker(1.5, 500, 100); // minROAS: 1.5, maxDailySpend: 500, emergencyReserve: 100
    agentState = new AgentState(1000, 50, 10); // initialCapital: 1000, dailyFee: 50, bankruptcyThreshold: 10
    
    // Add test data
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
      angle: 'Test angle',
      budget: 100,
      spend: 50,
      revenue: 100,
      roas: 2.0,
      status: 'active',
      createdDay: 1,
      lastOptimized: 1,
    });
    
    agentState.addProduct(product);
    agentState.addCampaign(campaign);
  });

  describe('daily metrics tracking', () => {
    it('should update daily metrics with enhanced calculations', () => {
      agentState.updateFinancials(200, 100);
      
      const metrics = financialTracker.updateDailyMetrics(agentState);
      
      expect(metrics).toHaveProperty('profitMargin');
      expect(metrics).toHaveProperty('burnRate');
      expect(metrics).toHaveProperty('daysUntilBankruptcy');
      expect(metrics).toHaveProperty('financialHealth');
      expect(metrics).toHaveProperty('availableBudget');
      expect(metrics).toHaveProperty('totalProfit');
      
      expect(metrics.profitMargin).toBe(50); // (200-100)/200 * 100
      expect(metrics.totalProfit).toBe(100); // 200-100
      expect(metrics.financialHealth).toBe('good'); // Net worth is $1100, which is > initial capital but < 2x initial capital
    });

    it('should calculate burn rate correctly', () => {
      // Simulate multiple days of spending
      agentState.updateFinancials(100, 80);
      financialTracker.updateDailyMetrics(agentState);
      
      agentState.advanceDay();
      agentState.updateFinancials(120, 90);
      const metrics = financialTracker.updateDailyMetrics(agentState);
      
      expect(metrics.burnRate).toBeGreaterThan(0);
    });

    it('should calculate days until bankruptcy', () => {
      // Create a state with limited funds and high burn rate
      const poorState = new AgentState(200, 50, 5);
      poorState.updateFinancials(50, 100); // Losing money
      
      const metrics = financialTracker.updateDailyMetrics(poorState);
      
      expect(metrics.daysUntilBankruptcy).toBeDefined();
      if (metrics.daysUntilBankruptcy !== null) {
        expect(metrics.daysUntilBankruptcy).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return high days until bankruptcy when highly profitable', () => {
      // Create a highly profitable scenario
      for (let i = 0; i < 8; i++) {
        agentState.advanceDay();
        agentState.updateFinancials(300, 0); // High revenue, no additional spend (only daily fee)
        financialTracker.updateDailyMetrics(agentState);
      }
      
      const metrics = financialTracker.updateDailyMetrics(agentState);
      
      // When highly profitable, days until bankruptcy should be very high
      expect(metrics.daysUntilBankruptcy).toBeGreaterThan(30);
    });
  });

  describe('financial alerts', () => {
    it('should generate bankruptcy alert', () => {
      // Force bankruptcy - need to exceed bankruptcy threshold
      const bankruptState = new AgentState(100, 50, 2); // bankruptcyThreshold = 2
      
      // Make net worth negative and advance enough days to trigger bankruptcy
      bankruptState.updateFinancials(0, 150); // Net worth becomes -50
      bankruptState.advanceDay(); // Day 1, net worth becomes -100, bankruptcyDays = 1
      bankruptState.advanceDay(); // Day 2, net worth becomes -150, bankruptcyDays = 2
      
      // Now agent should be bankrupt (bankruptcyDays >= bankruptcyThreshold)
      financialTracker.updateDailyMetrics(bankruptState);
      
      const alerts = financialTracker.getUnresolvedAlerts();
      expect(alerts.some(a => a.type === 'bankruptcy')).toBe(true);
    });

    it('should generate critical financial health alert', () => {
      // Create critical financial situation
      const criticalState = new AgentState(1000, 50, 5);
      criticalState.updateFinancials(100, 800); // Net worth becomes 300 (critical)
      
      financialTracker.updateDailyMetrics(criticalState);
      
      const alerts = financialTracker.getUnresolvedAlerts();
      expect(alerts.some(a => a.type === 'critical')).toBe(true);
    });

    it('should generate low ROAS warning', () => {
      // Create campaign with low ROAS
      const lowROASCampaign = new Campaign({
        productId: uuidv4(),
        platform: 'facebook',
        angle: 'Low ROAS test',
        budget: 200,
        spend: 150,
        revenue: 120, // ROAS = 0.8
        roas: 0.8,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      agentState.addCampaign(lowROASCampaign);
      agentState.updateFinancials(120, 150);
      
      financialTracker.updateDailyMetrics(agentState);
      
      const alerts = financialTracker.getUnresolvedAlerts();
      expect(alerts.some(a => a.message.includes('ROAS below threshold'))).toBe(true);
    });

    it('should generate high burn rate warning', () => {
      // Create situation with high burn rate leading to near bankruptcy
      const highBurnState = new AgentState(150, 50, 5);
      
      // Simulate high daily losses
      for (let i = 0; i < 3; i++) {
        highBurnState.advanceDay();
        highBurnState.updateFinancials(20, 60); // Losing $40 per day
        financialTracker.updateDailyMetrics(highBurnState);
      }
      
      const alerts = financialTracker.getUnresolvedAlerts();
      expect(alerts.some(a => a.message.includes('days until bankruptcy'))).toBe(true);
    });

    it('should generate daily spend limit alert', () => {
      // Simulate high daily spend by creating historical data
      agentState.updateFinancials(100, 100); // Day 0 baseline
      financialTracker.updateDailyMetrics(agentState);
      
      agentState.advanceDay();
      agentState.updateFinancials(200, 700); // Day 1: daily spend = 700 - 100 = 600 (over $500 limit)
      
      financialTracker.updateDailyMetrics(agentState);
      
      const alerts = financialTracker.getUnresolvedAlerts();
      expect(alerts.some(a => a.message.includes('Daily spend limit exceeded'))).toBe(true);
    });

    it('should detect negative cash flow trend', () => {
      // Simulate 3 days of negative cash flow
      for (let i = 0; i < 4; i++) {
        agentState.advanceDay();
        agentState.updateFinancials(30, 80); // Losing money each day
        financialTracker.updateDailyMetrics(agentState);
      }
      
      const alerts = financialTracker.getUnresolvedAlerts();
      expect(alerts.some(a => a.message.includes('Negative cash flow trend'))).toBe(true);
    });

    it('should not duplicate similar alerts', () => {
      // Generate same alert multiple times
      for (let i = 0; i < 3; i++) {
        agentState.updateFinancials(50, 200); // Same poor performance
        financialTracker.updateDailyMetrics(agentState);
      }
      
      const alerts = financialTracker.getUnresolvedAlerts();
      const roasAlerts = alerts.filter(a => a.message.includes('ROAS below threshold'));
      expect(roasAlerts).toHaveLength(1); // Should only have one alert
    });
  });

  describe('bankruptcy protection', () => {
    it('should implement emergency measures for critical financial health', () => {
      const criticalState = new AgentState(1000, 50, 5);
      
      // Add campaigns with different ROAS
      const losingCampaign = new Campaign({
        productId: uuidv4(),
        platform: 'facebook',
        angle: 'Losing campaign',
        budget: 100,
        spend: 100,
        revenue: 50, // ROAS = 0.5
        roas: 0.5,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      const breakEvenCampaign = new Campaign({
        productId: uuidv4(),
        platform: 'tiktok',
        angle: 'Break even campaign',
        budget: 100,
        spend: 80,
        revenue: 120, // ROAS = 1.5
        roas: 1.5,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      criticalState.addCampaign(losingCampaign);
      criticalState.addCampaign(breakEvenCampaign);
      
      // Force critical financial health
      criticalState.updateFinancials(100, 800);
      
      financialTracker.updateDailyMetrics(criticalState);
      
      // Check that losing campaign was killed
      expect(losingCampaign.status).toBe('killed');
      
      // Check that break-even campaign budget was reduced
      expect(breakEvenCampaign.budget).toBeLessThan(100);
    });

    it('should enforce spending limits', () => {
      // Create state with limited available budget
      const limitedState = new AgentState(200, 50, 5);
      
      const expensiveCampaign = new Campaign({
        productId: uuidv4(),
        platform: 'facebook',
        angle: 'Expensive campaign',
        budget: 300, // More than available budget
        spend: 50,
        revenue: 100,
        roas: 2.0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      limitedState.addCampaign(expensiveCampaign);
      
      financialTracker.updateDailyMetrics(limitedState);
      
      // Budget should be reduced to fit available budget
      expect(expensiveCampaign.budget).toBeLessThan(300);
    });

    it('should automatically kill losing campaigns', () => {
      const severeLossCampaign = new Campaign({
        productId: uuidv4(),
        platform: 'facebook',
        angle: 'Severe loss campaign',
        budget: 100,
        spend: 100,
        revenue: 30, // ROAS = 0.3 (severe loss)
        roas: 0.3,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      agentState.addCampaign(severeLossCampaign);
      
      financialTracker.updateDailyMetrics(agentState);
      
      expect(severeLossCampaign.status).toBe('killed');
    });

    it('should reduce budgets when bankruptcy is imminent', () => {
      const nearBankruptState = new AgentState(150, 50, 3);
      
      const campaign = new Campaign({
        productId: uuidv4(),
        platform: 'facebook',
        angle: 'Test campaign',
        budget: 100,
        spend: 50,
        revenue: 100,
        roas: 2.0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      nearBankruptState.addCampaign(campaign);
      
      // Simulate high burn rate
      for (let i = 0; i < 3; i++) {
        nearBankruptState.advanceDay();
        nearBankruptState.updateFinancials(20, 40);
        financialTracker.updateDailyMetrics(nearBankruptState);
      }
      
      // Budget should be reduced due to imminent bankruptcy
      expect(campaign.budget).toBeLessThan(100);
    });

    it('should allow disabling bankruptcy protection', () => {
      financialTracker.setBankruptcyProtection(false);
      
      const losingCampaign = new Campaign({
        productId: uuidv4(),
        platform: 'facebook',
        angle: 'Losing campaign',
        budget: 100,
        spend: 100,
        revenue: 30, // ROAS = 0.3
        roas: 0.3,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      agentState.addCampaign(losingCampaign);
      
      financialTracker.updateDailyMetrics(agentState);
      
      // Campaign should not be killed when protection is disabled
      expect(losingCampaign.status).toBe('active');
    });
  });

  describe('ROAS analysis', () => {
    it('should analyze ROAS performance correctly', () => {
      agentState.updateFinancials(300, 100); // ROAS = 3.0
      
      const analysis = financialTracker.analyzeROASPerformance(agentState);
      
      expect(analysis.currentROAS).toBe(3.0);
      expect(analysis.targetROAS).toBe(1.5);
      expect(analysis.performance).toBe('excellent');
      expect(analysis.recommendations).toContain('Scale all profitable campaigns');
      expect(analysis.campaignAnalysis).toHaveLength(1);
    });

    it('should provide campaign-specific recommendations', () => {
      const excellentCampaign = new Campaign({
        productId: uuidv4(),
        platform: 'facebook',
        angle: 'Excellent campaign',
        budget: 100,
        spend: 50,
        revenue: 200, // ROAS = 4.0
        roas: 4.0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      const poorCampaign = new Campaign({
        productId: uuidv4(),
        platform: 'tiktok',
        angle: 'Poor campaign',
        budget: 100,
        spend: 100,
        revenue: 80, // ROAS = 0.8
        roas: 0.8,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      agentState.addCampaign(excellentCampaign);
      agentState.addCampaign(poorCampaign);
      
      const analysis = financialTracker.analyzeROASPerformance(agentState);
      
      const excellentAnalysis = analysis.campaignAnalysis.find(c => c.roas === 4.0);
      const poorAnalysis = analysis.campaignAnalysis.find(c => c.roas === 0.8);
      
      expect(excellentAnalysis?.recommendation).toContain('Scale aggressively');
      expect(poorAnalysis?.recommendation).toContain('Kill immediately');
    });

    it('should categorize performance levels correctly', () => {
      const testCases = [
        { roas: 3.5, expected: 'excellent' },
        { roas: 2.2, expected: 'good' },
        { roas: 1.6, expected: 'acceptable' },
        { roas: 1.2, expected: 'poor' },
        { roas: 0.8, expected: 'critical' }
      ];
      
      testCases.forEach(({ roas, expected }) => {
        const testState = new AgentState(1000, 50, 10);
        testState.updateFinancials(roas * 100, 100);
        
        const analysis = financialTracker.analyzeROASPerformance(testState);
        expect(analysis.performance).toBe(expected);
      });
    });
  });

  describe('financial projections', () => {
    it('should calculate projections based on historical data', () => {
      // Build up some historical data
      for (let i = 0; i < 7; i++) {
        agentState.advanceDay();
        agentState.updateFinancials(100 + i * 10, 50 + i * 5);
        financialTracker.updateDailyMetrics(agentState);
      }
      
      const projections = financialTracker.calculateProjections(agentState, 30);
      
      expect(projections.projectedNetWorth).toBeDefined();
      expect(projections.projectedRevenue).toBeGreaterThan(0);
      expect(projections.projectedSpend).toBeGreaterThan(0);
      expect(projections.projectedROAS).toBeGreaterThan(0);
      expect(projections.bankruptcyRisk).toBeDefined();
      expect(projections.assumptions).toHaveLength(4);
    });

    it('should assess bankruptcy risk correctly', () => {
      // Create scenario leading to bankruptcy
      const riskyState = new AgentState(200, 50, 5);
      
      for (let i = 0; i < 5; i++) {
        riskyState.advanceDay();
        riskyState.updateFinancials(30, 80); // Losing money
        financialTracker.updateDailyMetrics(riskyState);
      }
      
      const projections = financialTracker.calculateProjections(riskyState, 30);
      
      expect(['high', 'critical']).toContain(projections.bankruptcyRisk);
    });

    it('should handle no historical data gracefully', () => {
      const newTracker = new FinancialTracker();
      const newState = new AgentState(1000, 50, 10);
      
      const projections = newTracker.calculateProjections(newState);
      
      expect(projections.projectedNetWorth).toBe(1000);
      expect(projections.assumptions).toContain('No historical data available');
    });
  });

  describe('comprehensive financial report', () => {
    it('should generate complete financial report', () => {
      agentState.updateFinancials(200, 100);
      
      const report = financialTracker.getFinancialReport(agentState);
      
      expect(report).toHaveProperty('currentStatus');
      expect(report).toHaveProperty('dailyMetrics');
      expect(report).toHaveProperty('roasAnalysis');
      expect(report).toHaveProperty('projections');
      expect(report).toHaveProperty('alerts');
      expect(report).toHaveProperty('trends');
      expect(report).toHaveProperty('recommendations');
      
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate trends correctly', () => {
      // Build up 14 days of data to calculate trends
      for (let i = 0; i < 14; i++) {
        agentState.advanceDay();
        // Simulate improving performance
        const revenue = 100 + i * 5;
        const spend = 80 + i * 2;
        agentState.updateFinancials(revenue, spend);
        financialTracker.updateDailyMetrics(agentState);
      }
      
      const report = financialTracker.getFinancialReport(agentState);
      
      expect(report.trends.revenueGrowth).toBeGreaterThan(0);
      expect(report.trends.spendGrowth).toBeGreaterThan(0);
      expect(['improving', 'stable', 'declining']).toContain(report.trends.roasTrend);
      expect(['improving', 'stable', 'declining']).toContain(report.trends.profitabilityTrend);
    });

    it('should remove duplicate recommendations', () => {
      // Create situation that might generate duplicate recommendations
      agentState.updateFinancials(50, 100); // Poor ROAS
      
      const report = financialTracker.getFinancialReport(agentState);
      
      const uniqueRecommendations = [...new Set(report.recommendations)];
      expect(report.recommendations).toEqual(uniqueRecommendations);
    });
  });

  describe('alert management', () => {
    it('should resolve alerts', () => {
      // Generate an alert
      agentState.updateFinancials(50, 150); // Poor ROAS
      financialTracker.updateDailyMetrics(agentState);
      
      const alertsBefore = financialTracker.getUnresolvedAlerts();
      expect(alertsBefore.length).toBeGreaterThan(0);
      
      const resolved = financialTracker.resolveAlert(0);
      expect(resolved).toBe(true);
      
      const alertsAfter = financialTracker.getUnresolvedAlerts();
      expect(alertsAfter.length).toBe(alertsBefore.length - 1);
    });

    it('should clear old resolved alerts', () => {
      // Generate and resolve an alert
      agentState.updateFinancials(50, 150);
      financialTracker.updateDailyMetrics(agentState);
      financialTracker.resolveAlert(0);
      
      const clearedCount = financialTracker.clearOldAlerts(0); // Clear immediately
      expect(clearedCount).toBeGreaterThan(0);
    });

    it('should handle invalid alert index', () => {
      const resolved = financialTracker.resolveAlert(999);
      expect(resolved).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should update thresholds', () => {
      financialTracker.updateThresholds(2.0, 1000, 200);
      
      const config = financialTracker.getConfiguration();
      expect(config.minROASThreshold).toBe(2.0);
      expect(config.maxDailySpendLimit).toBe(1000);
      expect(config.emergencyReserve).toBe(200);
    });

    it('should export financial data', () => {
      agentState.updateFinancials(100, 50);
      financialTracker.updateDailyMetrics(agentState);
      
      const exported = financialTracker.exportFinancialData();
      
      expect(exported).toHaveProperty('dailyMetrics');
      expect(exported).toHaveProperty('alerts');
      expect(exported).toHaveProperty('configuration');
      expect(exported).toHaveProperty('exportedAt');
      expect(exported.exportedAt).toBeInstanceOf(Date);
    });

    it('should get current configuration', () => {
      const config = financialTracker.getConfiguration();
      
      expect(config.minROASThreshold).toBe(1.5);
      expect(config.maxDailySpendLimit).toBe(500);
      expect(config.emergencyReserve).toBe(100);
      expect(config.bankruptcyProtectionEnabled).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero revenue gracefully', () => {
      agentState.updateFinancials(0, 100);
      
      const metrics = financialTracker.updateDailyMetrics(agentState);
      
      expect(metrics.profitMargin).toBe(0);
      expect(metrics.roas).toBe(0);
    });

    it('should handle zero spend gracefully', () => {
      agentState.updateFinancials(100, 0);
      
      const metrics = financialTracker.updateDailyMetrics(agentState);
      
      expect(metrics.profitMargin).toBe(100);
      expect(isFinite(metrics.roas)).toBe(true);
    });

    it('should handle negative net worth', () => {
      const negativeState = new AgentState(100, 50, 2);
      negativeState.updateFinancials(0, 200); // Net worth becomes -100
      
      const metrics = financialTracker.updateDailyMetrics(negativeState);
      
      expect(metrics.netWorth).toBeLessThan(0);
      expect(metrics.daysUntilBankruptcy).toBe(0);
    });
  });
});