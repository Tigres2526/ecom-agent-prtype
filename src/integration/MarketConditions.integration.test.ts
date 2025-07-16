import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DropshippingSimulation } from '../simulation/DropshippingSimulation.js';
import { Product } from '../models/Product.js';
import { Campaign } from '../models/Campaign.js';

describe('Market Conditions Integration Tests', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.GROK_API_KEY = 'test-grok-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  describe('Bull Market Conditions', () => {
    it('should thrive in favorable market conditions', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 1000,
        maxDays: 20,
        autoStart: false,
        testMode: true
      });

      // Mock bull market conditions - high ROAS, good conversion rates
      const mockBullMarketMetrics = vi.fn().mockImplementation(() => {
        return {
          impressions: 5000 + Math.random() * 2000,
          clicks: 250 + Math.random() * 100,
          conversions: 25 + Math.random() * 10,
          spend: 50,
          revenue: 500 + Math.random() * 200,
          ctr: 0.05 + Math.random() * 0.02,
          cpc: 0.20 + Math.random() * 0.05,
          roas: 10 + Math.random() * 5
        };
      });

      vi.spyOn(simulation, 'generateMockMetrics').mockImplementation(mockBullMarketMetrics);

      await simulation.start();

      // Run simulation for full duration
      while (simulation.getState().status === 'running' && simulation.getState().day < 20) {
        await simulation.simulateDay();
      }

      const finalState = simulation.getState();
      
      expect(finalState.status).toBe('completed');
      expect(finalState.netWorth).toBeGreaterThan(2000); // Should at least double
      expect(finalState.totalRevenue).toBeGreaterThan(5000);
      expect(finalState.successfulCampaigns).toBeGreaterThan(10);
      expect(finalState.totalROAS).toBeGreaterThan(5);
    });
  });

  describe('Bear Market Conditions', () => {
    it('should survive in poor market conditions', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 1000,
        maxDays: 20,
        autoStart: false,
        testMode: true
      });

      // Mock bear market conditions - low ROAS, poor conversions
      const mockBearMarketMetrics = vi.fn().mockImplementation(() => {
        return {
          impressions: 1000 + Math.random() * 500,
          clicks: 20 + Math.random() * 10,
          conversions: Math.random() > 0.7 ? 1 : 0, // 30% chance of conversion
          spend: 50,
          revenue: Math.random() > 0.7 ? 45 + Math.random() * 20 : 0,
          ctr: 0.02 + Math.random() * 0.01,
          cpc: 2.5 + Math.random() * 0.5,
          roas: Math.random() > 0.7 ? 0.9 + Math.random() * 0.5 : 0
        };
      });

      vi.spyOn(simulation, 'generateMockMetrics').mockImplementation(mockBearMarketMetrics);

      await simulation.start();

      // Run simulation
      while (simulation.getState().status === 'running' && simulation.getState().day < 20) {
        await simulation.simulateDay();
      }

      const finalState = simulation.getState();
      
      // Should either complete or go bankrupt, but not crash
      expect(['completed', 'bankrupt']).toContain(finalState.status);
      
      if (finalState.status === 'completed') {
        // If survived, should have implemented conservative strategies
        expect(finalState.failedCampaigns).toBeGreaterThan(finalState.successfulCampaigns);
      } else {
        // If bankrupt, should have proper bankruptcy tracking
        expect(finalState.bankruptcyDay).toBeDefined();
        expect(finalState.bankruptcyDay).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('Volatile Market Conditions', () => {
    it('should adapt to rapidly changing market conditions', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 1500,
        maxDays: 30,
        autoStart: false,
        testMode: true
      });

      let marketPhase = 'bull';
      let dayCount = 0;

      // Mock volatile market - alternates between good and bad conditions
      const mockVolatileMarketMetrics = vi.fn().mockImplementation(() => {
        dayCount++;
        
        // Change market phase every 5 days
        if (dayCount % 5 === 0) {
          marketPhase = marketPhase === 'bull' ? 'bear' : 'bull';
        }

        if (marketPhase === 'bull') {
          return {
            impressions: 3000 + Math.random() * 1000,
            clicks: 150 + Math.random() * 50,
            conversions: 15 + Math.random() * 5,
            spend: 40,
            revenue: 300 + Math.random() * 100,
            ctr: 0.05,
            cpc: 0.27,
            roas: 7.5 + Math.random() * 2.5
          };
        } else {
          return {
            impressions: 500 + Math.random() * 500,
            clicks: 10 + Math.random() * 10,
            conversions: Math.random() > 0.8 ? 1 : 0,
            spend: 40,
            revenue: Math.random() > 0.8 ? 35 : 0,
            ctr: 0.02,
            cpc: 4.0,
            roas: Math.random() > 0.8 ? 0.875 : 0
          };
        }
      });

      vi.spyOn(simulation, 'generateMockMetrics').mockImplementation(mockVolatileMarketMetrics);

      await simulation.start();

      const stateHistory = [];
      
      // Run simulation and track state changes
      while (simulation.getState().status === 'running' && simulation.getState().day < 30) {
        await simulation.simulateDay();
        stateHistory.push({
          day: simulation.getState().day,
          netWorth: simulation.getState().netWorth,
          activeCampaigns: simulation.getState().campaigns.size
        });
      }

      const finalState = simulation.getState();
      
      // Should complete the simulation
      expect(['completed', 'bankrupt']).toContain(finalState.status);
      
      // Verify adaptation to market changes
      const netWorthChanges = stateHistory.map((state, i) => 
        i > 0 ? state.netWorth - stateHistory[i-1].netWorth : 0
      );
      
      // Should have both positive and negative days
      const positiveDays = netWorthChanges.filter(change => change > 0).length;
      const negativeDays = netWorthChanges.filter(change => change < 0).length;
      
      expect(positiveDays).toBeGreaterThan(0);
      expect(negativeDays).toBeGreaterThan(0);
    });
  });

  describe('Seasonal Market Patterns', () => {
    it('should handle seasonal trends effectively', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 2000,
        maxDays: 30,
        autoStart: false,
        testMode: true
      });

      let dayOfSimulation = 0;

      // Mock seasonal patterns - holiday season boost
      const mockSeasonalMetrics = vi.fn().mockImplementation(() => {
        dayOfSimulation++;
        
        // Days 20-25 simulate holiday season
        const isHolidaySeason = dayOfSimulation >= 20 && dayOfSimulation <= 25;
        const seasonMultiplier = isHolidaySeason ? 3 : 1;

        return {
          impressions: (2000 + Math.random() * 1000) * seasonMultiplier,
          clicks: (100 + Math.random() * 50) * seasonMultiplier,
          conversions: (10 + Math.random() * 5) * seasonMultiplier,
          spend: 50,
          revenue: (200 + Math.random() * 100) * seasonMultiplier,
          ctr: 0.05,
          cpc: 0.50 / seasonMultiplier,
          roas: (4 + Math.random() * 2) * seasonMultiplier
        };
      });

      vi.spyOn(simulation, 'generateMockMetrics').mockImplementation(mockSeasonalMetrics);

      await simulation.start();

      const dailyRevenue = [];
      
      // Run simulation and track daily revenue
      while (simulation.getState().status === 'running' && simulation.getState().day < 30) {
        const beforeRevenue = simulation.getState().totalRevenue;
        await simulation.simulateDay();
        const afterRevenue = simulation.getState().totalRevenue;
        dailyRevenue.push(afterRevenue - beforeRevenue);
      }

      const finalState = simulation.getState();
      
      expect(finalState.status).toBe('completed');
      
      // Revenue during holiday season (days 20-25) should be significantly higher
      const regularDaysRevenue = dailyRevenue.slice(0, 19).reduce((a, b) => a + b, 0) / 19;
      const holidayRevenue = dailyRevenue.slice(19, 25).reduce((a, b) => a + b, 0) / 6;
      
      expect(holidayRevenue).toBeGreaterThan(regularDaysRevenue * 2);
      
      // Should have scaled campaigns during holiday season
      expect(finalState.totalRevenue).toBeGreaterThan(10000);
    });
  });

  describe('Competitive Market Dynamics', () => {
    it('should handle increasing competition', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 1500,
        maxDays: 25,
        autoStart: false,
        testMode: true
      });

      let competitionLevel = 1;
      let dayCount = 0;

      // Mock increasing competition - CPCs rise, conversions drop
      const mockCompetitiveMetrics = vi.fn().mockImplementation(() => {
        dayCount++;
        
        // Competition increases every 5 days
        if (dayCount % 5 === 0) {
          competitionLevel += 0.5;
        }

        const cpc = 0.30 * competitionLevel;
        const conversionRate = Math.max(0.01, 0.1 / competitionLevel);

        return {
          impressions: 2000,
          clicks: 100,
          conversions: Math.floor(100 * conversionRate),
          spend: 100 * cpc,
          revenue: Math.floor(100 * conversionRate) * 45,
          ctr: 0.05,
          cpc: cpc,
          roas: (Math.floor(100 * conversionRate) * 45) / (100 * cpc)
        };
      });

      vi.spyOn(simulation, 'generateMockMetrics').mockImplementation(mockCompetitiveMetrics);

      await simulation.start();

      const campaignHistory = [];
      
      // Run simulation and track campaign performance
      while (simulation.getState().status === 'running' && simulation.getState().day < 25) {
        await simulation.simulateDay();
        
        const activeCampaigns = Array.from(simulation.getState().campaigns.values())
          .filter(c => c.status === 'active');
        
        campaignHistory.push({
          day: simulation.getState().day,
          activeCampaignCount: activeCampaigns.length,
          avgBudget: activeCampaigns.reduce((sum, c) => sum + c.budget, 0) / (activeCampaigns.length || 1)
        });
      }

      const finalState = simulation.getState();
      
      // Should adapt to competition
      expect(['completed', 'bankrupt']).toContain(finalState.status);
      
      // Should reduce campaign count or budgets as competition increases
      const earlyAvgBudget = campaignHistory.slice(0, 5).reduce((sum, h) => sum + h.avgBudget, 0) / 5;
      const lateAvgBudget = campaignHistory.slice(-5).reduce((sum, h) => sum + h.avgBudget, 0) / 5;
      
      expect(lateAvgBudget).toBeLessThanOrEqual(earlyAvgBudget);
    });
  });

  describe('Product Lifecycle Scenarios', () => {
    it('should handle product saturation and trends', async () => {
      const simulation = new DropshippingSimulation({
        initialCapital: 2000,
        maxDays: 30,
        autoStart: false,
        testMode: true
      });

      const productPerformance = new Map();
      let dayCount = 0;

      // Mock product lifecycle - products perform well initially then decline
      const mockProductLifecycleMetrics = vi.fn().mockImplementation((campaign) => {
        dayCount++;
        
        const productId = campaign?.productId || 'default';
        const productAge = productPerformance.get(productId) || 0;
        productPerformance.set(productId, productAge + 1);

        // Performance declines with product age
        const performanceMultiplier = Math.max(0.1, 1 - (productAge * 0.05));

        return {
          impressions: 2000 * performanceMultiplier,
          clicks: Math.floor(100 * performanceMultiplier),
          conversions: Math.floor(10 * performanceMultiplier),
          spend: 50,
          revenue: Math.floor(10 * performanceMultiplier) * 50,
          ctr: 0.05 * performanceMultiplier,
          cpc: 0.50 / performanceMultiplier,
          roas: (Math.floor(10 * performanceMultiplier) * 50) / 50
        };
      });

      vi.spyOn(simulation, 'generateMockMetrics').mockImplementation(mockProductLifecycleMetrics);

      await simulation.start();

      const productRotation = [];
      
      // Run simulation and track product changes
      while (simulation.getState().status === 'running' && simulation.getState().day < 30) {
        const beforeProducts = Array.from(simulation.getState().products.keys());
        await simulation.simulateDay();
        const afterProducts = Array.from(simulation.getState().products.keys());
        
        const newProducts = afterProducts.filter(p => !beforeProducts.includes(p));
        if (newProducts.length > 0) {
          productRotation.push({
            day: simulation.getState().day,
            newProducts: newProducts.length
          });
        }
      }

      const finalState = simulation.getState();
      
      expect(finalState.status).toBe('completed');
      
      // Should have rotated products as performance declined
      expect(productRotation.length).toBeGreaterThan(0);
      expect(finalState.products.size).toBeGreaterThan(3);
      
      // Should have killed underperforming campaigns
      expect(finalState.failedCampaigns).toBeGreaterThan(0);
    });
  });
});