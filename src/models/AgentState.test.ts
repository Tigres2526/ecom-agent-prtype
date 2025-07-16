import { describe, it, expect } from 'vitest';
import { AgentState } from './AgentState.js';
import { Product } from './Product.js';
import { Campaign } from './Campaign.js';

describe('AgentState', () => {
  const initialCapital = 1000;
  const dailyFee = 50;
  const bankruptcyThreshold = 10;

  describe('constructor', () => {
    it('should create a valid agent state', () => {
      const state = new AgentState(initialCapital, dailyFee, bankruptcyThreshold);
      
      expect(state.currentDay).toBe(0);
      expect(state.netWorth).toBe(initialCapital);
      expect(state.dailyFee).toBe(dailyFee);
      expect(state.activeProducts).toEqual([]);
      expect(state.activeCampaigns).toEqual([]);
      expect(state.bankruptcyDays).toBe(0);
      expect(state.errorCount).toBe(0);
    });

    it('should throw error for invalid parameters', () => {
      expect(() => {
        new AgentState(-100, dailyFee);
      }).toThrow('Initial capital must be positive');

      expect(() => {
        new AgentState(initialCapital, -10);
      }).toThrow('Daily fee must be positive');

      expect(() => {
        new AgentState(initialCapital, dailyFee, -5);
      }).toThrow('Bankruptcy threshold must be positive');
    });
  });

  describe('day advancement', () => {
    it('should advance day and deduct fees', () => {
      const state = new AgentState(initialCapital, dailyFee);
      
      state.advanceDay();
      expect(state.currentDay).toBe(1);
      expect(state.netWorth).toBe(initialCapital - dailyFee);
      expect(state.totalSpend).toBe(dailyFee);
    });

    it('should track bankruptcy days', () => {
      const state = new AgentState(100, 50); // Will go negative after 2 days
      
      state.advanceDay(); // Day 1: 50 net worth
      expect(state.bankruptcyDays).toBe(0);
      
      state.advanceDay(); // Day 2: 0 net worth
      expect(state.bankruptcyDays).toBe(0);
      
      state.advanceDay(); // Day 3: -50 net worth
      expect(state.bankruptcyDays).toBe(1);
      
      state.advanceDay(); // Day 4: -100 net worth
      expect(state.bankruptcyDays).toBe(2);
    });

    it('should reset bankruptcy days when positive', () => {
      const state = new AgentState(100, 50);
      
      // Go negative
      state.advanceDay();
      state.advanceDay();
      state.advanceDay();
      expect(state.bankruptcyDays).toBe(1);
      
      // Add revenue to go positive
      state.updateFinancials(200, 0);
      expect(state.bankruptcyDays).toBe(0);
    });
  });

  describe('financial updates', () => {
    it('should update financials correctly', () => {
      const state = new AgentState(initialCapital, dailyFee);
      
      state.updateFinancials(200, 100);
      expect(state.totalRevenue).toBe(200);
      expect(state.totalSpend).toBe(100);
      expect(state.netWorth).toBe(initialCapital + 100); // +200 revenue -100 spend
      expect(state.currentROAS).toBe(2.0);
    });

    it('should reject negative values', () => {
      const state = new AgentState(initialCapital, dailyFee);
      
      expect(() => {
        state.updateFinancials(-100, 50);
      }).toThrow('Revenue and ad spend must be non-negative');
    });

    it('should calculate ROAS correctly', () => {
      const state = new AgentState(initialCapital, dailyFee);
      
      state.updateFinancials(300, 100);
      expect(state.currentROAS).toBe(3.0);
      
      state.updateFinancials(100, 100); // Additional spend/revenue
      expect(state.currentROAS).toBe(2.0); // (400 total revenue / 200 total spend)
    });
  });

  describe('bankruptcy checks', () => {
    it('should detect bankruptcy', () => {
      const state = new AgentState(100, 50, 3);
      
      // Go negative for 3 days
      state.advanceDay();
      state.advanceDay();
      state.advanceDay();
      expect(state.bankruptcyDays).toBe(1);
      expect(state.isBankrupt()).toBe(false);
      
      state.advanceDay();
      state.advanceDay();
      expect(state.bankruptcyDays).toBe(3);
      expect(state.isBankrupt()).toBe(true);
    });

    it('should check affordability', () => {
      const state = new AgentState(1000, 50);
      
      expect(state.canAfford(500)).toBe(true);
      expect(state.canAfford(1500)).toBe(false);
    });

    it('should calculate available budget', () => {
      const state = new AgentState(1000, 50);
      
      // Should reserve 7 days of fees (350)
      expect(state.getAvailableBudget()).toBe(650);
      
      // When net worth is low
      const poorState = new AgentState(200, 50);
      expect(poorState.getAvailableBudget()).toBe(0); // 200 - 350 = negative, so 0
    });
  });

  describe('product management', () => {
    it('should add and remove products', () => {
      const state = new AgentState(initialCapital, dailyFee);
      const product = new Product({
        name: 'Test Product',
        sourceUrl: 'https://example.com',
        supplierPrice: 10,
        recommendedPrice: 30,
        margin: 20,
        contentScore: 75,
        competitorCount: 15,
        status: 'researching',
        createdDay: 1,
      });
      
      state.addProduct(product);
      expect(state.activeProducts).toHaveLength(1);
      expect(state.getProduct(product.id)).toBe(product);
      
      state.removeProduct(product.id);
      expect(state.activeProducts).toHaveLength(0);
      expect(state.getProduct(product.id)).toBeUndefined();
    });

    it('should prevent duplicate products', () => {
      const state = new AgentState(initialCapital, dailyFee);
      const product = new Product({
        name: 'Test Product',
        sourceUrl: 'https://example.com',
        supplierPrice: 10,
        recommendedPrice: 30,
        margin: 20,
        contentScore: 75,
        competitorCount: 15,
        status: 'researching',
        createdDay: 1,
      });
      
      state.addProduct(product);
      expect(() => {
        state.addProduct(product);
      }).toThrow('Product already exists');
    });
  });

  describe('campaign management', () => {
    it('should add and remove campaigns', () => {
      const state = new AgentState(initialCapital, dailyFee);
      const campaign = new Campaign({
        productId: '123e4567-e89b-12d3-a456-426614174000',
        platform: 'facebook',
        angle: 'Test angle',
        budget: 100,
        spend: 50,
        revenue: 150,
        roas: 3.0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      state.addCampaign(campaign);
      expect(state.activeCampaigns).toHaveLength(1);
      expect(state.getCampaign(campaign.id)).toBe(campaign);
      
      state.removeCampaign(campaign.id);
      expect(state.activeCampaigns).toHaveLength(0);
      expect(state.getCampaign(campaign.id)).toBeUndefined();
    });

    it('should get campaigns for product', () => {
      const state = new AgentState(initialCapital, dailyFee);
      const productId = '123e4567-e89b-12d3-a456-426614174000';
      
      const campaign1 = new Campaign({
        productId,
        platform: 'facebook',
        angle: 'Angle 1',
        budget: 100,
        spend: 50,
        revenue: 150,
        roas: 3.0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      const campaign2 = new Campaign({
        productId: '223e4567-e89b-12d3-a456-426614174001',
        platform: 'tiktok',
        angle: 'Angle 2',
        budget: 100,
        spend: 50,
        revenue: 150,
        roas: 3.0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1,
      });
      
      state.addCampaign(campaign1);
      state.addCampaign(campaign2);
      
      const productCampaigns = state.getCampaignsForProduct(productId);
      expect(productCampaigns).toHaveLength(1);
      expect(productCampaigns[0]).toBe(campaign1);
    });
  });

  describe('error management', () => {
    it('should track error count', () => {
      const state = new AgentState(initialCapital, dailyFee);
      
      expect(state.errorCount).toBe(0);
      expect(state.hasExcessiveErrors()).toBe(false);
      
      for (let i = 0; i < 12; i++) {
        state.incrementErrorCount();
      }
      
      expect(state.errorCount).toBe(12);
      expect(state.hasExcessiveErrors()).toBe(true);
      
      state.resetErrorCount();
      expect(state.errorCount).toBe(0);
    });
  });

  describe('financial health', () => {
    it('should assess excellent health', () => {
      const state = new AgentState(1000, 50);
      state.updateFinancials(1500, 500); // Net worth becomes 2000
      
      const health = state.getFinancialHealth();
      expect(health.status).toBe('excellent');
      expect(health.recommendation).toBe('Scale aggressively');
    });

    it('should assess critical health', () => {
      const state = new AgentState(1000, 50);
      state.updateFinancials(100, 700); // Net worth becomes 400
      
      const health = state.getFinancialHealth();
      expect(health.status).toBe('critical');
      expect(health.recommendation).toBe('Enter conservative mode immediately');
    });

    it('should detect bankruptcy', () => {
      const state = new AgentState(75, 50, 2); // Start with less capital
      
      // Force bankruptcy by spending all capital
      state.advanceDay(); // Day 1: 75 - 50 = 25
      state.advanceDay(); // Day 2: 25 - 50 = -25 (bankruptcyDays = 1)
      state.advanceDay(); // Day 3: -25 - 50 = -75 (bankruptcyDays = 2)
      
      const health = state.getFinancialHealth();
      expect(health.status).toBe('bankrupt');
      expect(health.daysUntilBankruptcy).toBe(0);
    });
  });

  describe('metrics and summary', () => {
    it('should generate daily metrics', () => {
      const state = new AgentState(1000, 50);
      state.advanceDay();
      state.updateFinancials(200, 100);
      
      const metrics = state.getDailyMetrics();
      expect(metrics.day).toBe(1);
      expect(metrics.netWorth).toBe(1050); // 1000 - 50 + 200 - 100
      expect(metrics.revenue).toBe(200);
      expect(metrics.spend).toBe(150); // 50 daily fee + 100 ad spend
      expect(metrics.roas).toBeCloseTo(1.33, 2);
    });

    it('should generate summary statistics', () => {
      const state = new AgentState(1000, 50);
      state.updateFinancials(300, 150);
      
      const summary = state.getSummary();
      expect(summary.totalProfit).toBe(150);
      expect(summary.profitMargin).toBe(50); // (150/300) * 100
      expect(summary.averageROAS).toBe(2.0);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const state = new AgentState(1000, 50, 10);
      state.advanceDay();
      state.updateFinancials(200, 100);
      
      const json = state.toJSON();
      const recreated = AgentState.fromJSON(json, 1000, 10);
      
      expect(recreated.currentDay).toBe(state.currentDay);
      expect(recreated.netWorth).toBe(state.netWorth);
      expect(recreated.totalRevenue).toBe(state.totalRevenue);
      expect(recreated.currentROAS).toBe(state.currentROAS);
    });

    it('should validate data correctly', () => {
      const state = new AgentState(1000, 50);
      expect(AgentState.validate(state.toJSON())).toBe(true);
      expect(AgentState.validate({ invalid: 'data' })).toBe(false);
    });
  });
});