import { describe, it, expect } from 'vitest';
import { Campaign } from './Campaign.js';

describe('Campaign', () => {
  const validCampaignData = {
    productId: '123e4567-e89b-12d3-a456-426614174000',
    platform: 'facebook' as const,
    angle: 'Problem-solving angle',
    budget: 100,
    spend: 50,
    revenue: 150,
    roas: 3.0,
    status: 'active' as const,
    createdDay: 1,
    lastOptimized: 1,
  };

  describe('constructor', () => {
    it('should create a valid campaign', () => {
      const campaign = new Campaign(validCampaignData);
      
      expect(campaign.productId).toBe(validCampaignData.productId);
      expect(campaign.platform).toBe(validCampaignData.platform);
      expect(campaign.angle).toBe(validCampaignData.angle);
      expect(campaign.roas).toBe(validCampaignData.roas);
      expect(campaign.id).toBeDefined();
    });

    it('should generate UUID if not provided', () => {
      const campaign = new Campaign(validCampaignData);
      expect(campaign.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should throw error for invalid ROAS calculation', () => {
      expect(() => {
        new Campaign({
          ...validCampaignData,
          roas: 2.0, // Should be 3.0 (150 / 50)
        });
      }).toThrow('ROAS inconsistency');
    });

    it('should handle zero spend correctly', () => {
      const campaign = new Campaign({
        ...validCampaignData,
        spend: 0,
        revenue: 0,
        roas: 0,
      });
      expect(campaign.roas).toBe(0);
    });

    it('should throw error for negative values', () => {
      expect(() => {
        new Campaign({
          ...validCampaignData,
          spend: -10,
        });
      }).toThrow();
    });
  });

  describe('metrics updates', () => {
    it('should update metrics correctly', () => {
      const campaign = new Campaign(validCampaignData);
      
      campaign.updateMetrics(75, 225, 2);
      expect(campaign.spend).toBe(75);
      expect(campaign.revenue).toBe(225);
      expect(campaign.roas).toBe(3.0);
      expect(campaign.lastOptimized).toBe(2);
    });

    it('should reject negative metrics', () => {
      const campaign = new Campaign(validCampaignData);
      
      expect(() => {
        campaign.updateMetrics(-10, 100, 2);
      }).toThrow('Spend and revenue must be non-negative');
    });

    it('should update detailed metrics', () => {
      const campaign = new Campaign(validCampaignData);
      
      campaign.updateDetailedMetrics({
        impressions: 1000,
        clicks: 50,
        conversions: 5,
      });
      
      expect(campaign.impressions).toBe(1000);
      expect(campaign.clicks).toBe(50);
      expect(campaign.conversions).toBe(5);
      expect(campaign.ctr).toBe(5); // (50/1000) * 100
    });
  });

  describe('performance checks', () => {
    it('should check breakeven ROAS', () => {
      const campaign = new Campaign(validCampaignData);
      expect(campaign.meetsBreakevenROAS(1.5)).toBe(true);
      expect(campaign.meetsBreakevenROAS(4.0)).toBe(false);
    });

    it('should check profitability', () => {
      const campaign = new Campaign(validCampaignData);
      expect(campaign.isProfitable()).toBe(true);

      const losingCampaign = new Campaign({
        ...validCampaignData,
        revenue: 25,
        roas: 0.5,
      });
      expect(losingCampaign.isProfitable()).toBe(false);
    });

    it('should check scaling readiness', () => {
      const campaign = new Campaign(validCampaignData);
      expect(campaign.isReadyForScaling(2.0, 50)).toBe(true);
      expect(campaign.isReadyForScaling(4.0, 50)).toBe(false);
    });

    it('should check if campaign should be killed', () => {
      const losingCampaign = new Campaign({
        ...validCampaignData,
        spend: 100,
        revenue: 50,
        roas: 0.5,
      });
      expect(losingCampaign.shouldBeKilled(1.0, 50)).toBe(true);

      const winningCampaign = new Campaign(validCampaignData);
      expect(winningCampaign.shouldBeKilled(1.0, 50)).toBe(false);
    });
  });

  describe('status management', () => {
    it('should allow valid status transitions', () => {
      const campaign = new Campaign(validCampaignData);
      
      expect(campaign.status).toBe('active');
      campaign.updateStatus('paused');
      expect(campaign.status).toBe('paused');
      
      campaign.updateStatus('active');
      expect(campaign.status).toBe('active');
      
      campaign.updateStatus('killed');
      expect(campaign.status).toBe('killed');
    });

    it('should reject invalid status transitions', () => {
      const campaign = new Campaign({ ...validCampaignData, status: 'killed' });
      
      expect(() => {
        campaign.updateStatus('active');
      }).toThrow('Invalid status transition');
    });
  });

  describe('budget scaling', () => {
    it('should scale budget for ready campaigns', () => {
      const campaign = new Campaign({
        ...validCampaignData,
        spend: 150, // Above minimum
        revenue: 375, // 150 * 2.5 = 375
        roas: 2.5, // Above minimum
      });
      
      campaign.scaleBudget(200, 'High ROAS performance');
      expect(campaign.budget).toBe(200);
    });

    it('should reject scaling for inactive campaigns', () => {
      const campaign = new Campaign({ ...validCampaignData, status: 'paused' });
      
      expect(() => {
        campaign.scaleBudget(200, 'Test');
      }).toThrow('Can only scale active campaigns');
    });

    it('should reject scaling for unready campaigns', () => {
      const campaign = new Campaign({
        ...validCampaignData,
        spend: 10, // Below minimum
        revenue: 15, // 10 * 1.5 = 15
        roas: 1.5, // Below minimum
      });
      
      expect(() => {
        campaign.scaleBudget(200, 'Test');
      }).toThrow('Campaign is not ready for scaling');
    });
  });

  describe('performance summary', () => {
    it('should generate performance summary', () => {
      const campaign = new Campaign(validCampaignData);
      const summary = campaign.getPerformanceSummary();
      
      expect(summary.roas).toBe(3.0);
      expect(summary.profit).toBe(100); // 150 - 50
      expect(summary.efficiency).toBe('excellent');
      expect(summary.recommendation).toBe('Scale aggressively');
    });

    it('should recommend killing losing campaigns', () => {
      const losingCampaign = new Campaign({
        ...validCampaignData,
        revenue: 25,
        roas: 0.5,
      });
      
      const summary = losingCampaign.getPerformanceSummary();
      expect(summary.efficiency).toBe('losing');
      expect(summary.recommendation).toBe('Kill immediately');
    });
  });

  describe('conversion rate', () => {
    it('should calculate conversion rate when data available', () => {
      const campaign = new Campaign(validCampaignData);
      campaign.updateDetailedMetrics({
        clicks: 100,
        conversions: 5,
      });
      
      expect(campaign.getConversionRate()).toBe(5);
    });

    it('should return null when data not available', () => {
      const campaign = new Campaign(validCampaignData);
      expect(campaign.getConversionRate()).toBeNull();
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const campaign = new Campaign(validCampaignData);
      const json = campaign.toJSON();
      
      expect(json.productId).toBe(validCampaignData.productId);
      expect(json.platform).toBe(validCampaignData.platform);
      expect(json.roas).toBe(validCampaignData.roas);
    });

    it('should create from JSON correctly', () => {
      const campaign = new Campaign(validCampaignData);
      const json = campaign.toJSON();
      const recreated = Campaign.fromJSON(json);
      
      expect(recreated.productId).toBe(campaign.productId);
      expect(recreated.roas).toBe(campaign.roas);
      expect(recreated.id).toBe(campaign.id);
    });

    it('should validate data correctly', () => {
      const campaign = new Campaign(validCampaignData);
      expect(Campaign.validate(campaign.toJSON())).toBe(true);
      expect(Campaign.validate({ invalid: 'data' })).toBe(false);
    });
  });
});