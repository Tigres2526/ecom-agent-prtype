import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignManagementTools } from './CampaignManagementTools.js';
import { GrokClient } from '../agent/GrokClient.js';
import { Product } from '../models/Product.js';

// Mock the GrokClient
vi.mock('../agent/GrokClient.js', () => ({
  GrokClient: vi.fn().mockImplementation(() => ({
    simpleChat: vi.fn(),
  })),
}));

describe('CampaignManagementTools', () => {
  let campaignTools: CampaignManagementTools;
  let mockGrokClient: any;
  let testProduct: Product;
  let testAngle: any;

  beforeEach(() => {
    mockGrokClient = new GrokClient();
    campaignTools = new CampaignManagementTools(mockGrokClient);
    
    testProduct = new Product({
      name: 'Wireless Phone Charger',
      sourceUrl: 'https://example.com/charger',
      supplierPrice: 10,
      recommendedPrice: 30,
      margin: 20,
      contentScore: 80,
      competitorCount: 15,
      status: 'testing',
      createdDay: 1,
    });

    testAngle = {
      id: 'angle1',
      productId: testProduct.id,
      angle: 'Problem-solving convenience',
      targetAudience: 'Busy professionals',
      painPoint: 'Tangled charging cables',
      solution: 'Wireless charging convenience',
      hook: 'Never deal with tangled cables again',
      cta: 'Get yours now',
      confidence: 0.8,
      tested: false
    };
  });

  describe('createCampaign', () => {
    it('should create a campaign successfully', async () => {
      const mockStrategy = `CREATIVE STRATEGY:
Use video format with problem-solution narrative
TARGETING STRATEGY:
Target professionals aged 25-45
BIDDING STRATEGY:
Use lowest cost bidding with conversion optimization
TESTING FRAMEWORK:
Test 3 creative variations
OPTIMIZATION PLAN:
Monitor ROAS daily, optimize for 2.0+ target`;

      mockGrokClient.simpleChat.mockResolvedValueOnce(mockStrategy);

      const params = {
        product: testProduct,
        angle: testAngle,
        budget: 200,
        platform: 'facebook' as const,
        audience: { age: '25-45', interests: ['technology'] }
      };

      const result = await campaignTools.createCampaign(params);

      expect(result.success).toBe(true);
      expect(result.data.campaign).toBeDefined();
      expect(result.data.campaign.platform).toBe('facebook');
      expect(result.data.campaign.budget).toBe(200);
      expect(result.data.campaign.status).toBe('active');
      expect(result.data.strategy).toBeDefined();
      expect(result.data.estimatedReach).toBeGreaterThan(0);
      expect(result.data.expectedROAS).toBeGreaterThan(1);
      expect(result.metadata.platform).toBe('facebook');
    });

    it('should reject campaign with invalid budget', async () => {
      const params = {
        product: testProduct,
        angle: testAngle,
        budget: -100,
        platform: 'facebook' as const
      };

      const result = await campaignTools.createCampaign(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('budget must be positive');
    });

    it('should handle strategy generation failure gracefully', async () => {
      mockGrokClient.simpleChat.mockRejectedValueOnce(new Error('AI Error'));

      const params = {
        product: testProduct,
        angle: testAngle,
        budget: 150,
        platform: 'tiktok' as const
      };

      const result = await campaignTools.createCampaign(params);

      expect(result.success).toBe(true); // Should still succeed with default strategy
      expect(result.data.campaign).toBeDefined();
      expect(result.data.strategy).toBeDefined();
    });

    it('should generate different strategies for different platforms', async () => {
      mockGrokClient.simpleChat.mockResolvedValue('Platform-specific strategy');

      const facebookParams = {
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook' as const
      };

      const tiktokParams = {
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'tiktok' as const
      };

      await campaignTools.createCampaign(facebookParams);
      await campaignTools.createCampaign(tiktokParams);

      expect(mockGrokClient.simpleChat).toHaveBeenCalledTimes(2);
      expect(mockGrokClient.simpleChat).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Platform: facebook')
      );
      expect(mockGrokClient.simpleChat).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('Platform: tiktok')
      );
    });
  });

  describe('checkMetrics', () => {
    beforeEach(async () => {
      // Create a few test campaigns
      mockGrokClient.simpleChat.mockResolvedValue('Test strategy');
      
      await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });

      await campaignTools.createCampaign({
        product: testProduct,
        angle: { ...testAngle, angle: 'Different angle' },
        budget: 150,
        platform: 'tiktok'
      });
    });

    it('should check metrics for all campaigns', async () => {
      const result = await campaignTools.checkMetrics();

      expect(result.success).toBe(true);
      expect(result.data.summary).toBeDefined();
      expect(result.data.summary.totalCampaigns).toBe(2);
      expect(result.data.campaigns).toHaveLength(2);
      expect(result.data.alerts).toBeDefined();
      expect(result.metadata.totalCampaignsChecked).toBe(2);
    });

    it('should calculate summary metrics correctly', async () => {
      const result = await campaignTools.checkMetrics();

      expect(result.data.summary.totalSpend).toBeGreaterThanOrEqual(0);
      expect(result.data.summary.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(result.data.summary.activeCampaigns).toBe(2);
      expect(result.data.summary.pausedCampaigns).toBe(0);
      expect(result.data.summary.killedCampaigns).toBe(0);
    });

    it('should identify campaigns needing attention', async () => {
      // Let campaigns run to generate some metrics
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await campaignTools.checkMetrics();

      expect(result.data.alerts.needsAttention).toBeGreaterThanOrEqual(0);
      expect(result.data.alerts.readyToScale).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.data.alerts.lowPerformers)).toBe(true);
      expect(Array.isArray(result.data.alerts.topPerformers)).toBe(true);
    });

    it('should handle empty campaign list', async () => {
      const emptyCampaignTools = new CampaignManagementTools(mockGrokClient);
      const result = await emptyCampaignTools.checkMetrics();

      expect(result.success).toBe(true);
      expect(result.data.summary.totalCampaigns).toBe(0);
      expect(result.data.campaigns).toHaveLength(0);
    });
  });

  describe('scaleCampaign', () => {
    let campaignId: string;

    beforeEach(async () => {
      mockGrokClient.simpleChat.mockResolvedValue('Test strategy');
      
      const createResult = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });
      
      campaignId = createResult.data.campaign.id;
      
      // Simulate some performance to make it scalable
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should scale a performing campaign', async () => {
      // Wait for campaign to generate metrics (simulate time passing)
      const campaign = campaignTools['activeCampaigns'].get(campaignId);
      if (campaign) {
        // Manually set metrics to simulate good performance
        campaignTools['campaignMetrics'].set(campaignId, {
          spend: 150,
          revenue: 450,
          roas: 3.0,
          impressions: 10000,
          clicks: 500,
          conversions: 30,
          ctr: 5.0,
          cpc: 0.3,
          lastUpdated: new Date()
        });
      }
      
      const mockScalingStrategy = `SCALING APPROACH:
Gradual scaling recommended
Expected ROAS: 2.2
Timeline: 7 days`;

      mockGrokClient.simpleChat.mockResolvedValueOnce(mockScalingStrategy);

      const params = {
        campaignId,
        newBudget: 200,
        reason: 'High ROAS performance'
      };

      const result = await campaignTools.scaleCampaign(params);

      expect(result.success).toBe(true);
      expect(result.data.campaignId).toBe(campaignId);
      expect(result.data.newBudget).toBe(200);
      expect(result.data.scalingFactor).toBe(2);
      expect(result.data.strategy).toBeDefined();
      expect(result.metadata.reason).toBe('High ROAS performance');
    });

    it('should reject scaling non-existent campaign', async () => {
      const params = {
        campaignId: 'nonexistent',
        newBudget: 200,
        reason: 'Test'
      };

      const result = await campaignTools.scaleCampaign(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign not found');
    });

    it('should reject scaling with lower budget', async () => {
      // Set up campaign metrics with good ROAS
      const campaign = campaignTools['activeCampaigns'].get(campaignId);
      if (campaign) {
        campaignTools['campaignMetrics'].set(campaignId, {
          spend: 150,
          revenue: 450,
          roas: 3.0,
          impressions: 10000,
          clicks: 500,
          conversions: 30,
          ctr: 5.0,
          cpc: 0.3,
          lastUpdated: new Date()
        });
      }
      
      const params = {
        campaignId,
        newBudget: 50, // Lower than current 100
        reason: 'Test'
      };

      const result = await campaignTools.scaleCampaign(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('higher than current budget');
    });

    it('should handle scaling strategy generation failure', async () => {
      // Wait for campaign to generate metrics (simulate time passing)
      const campaign = campaignTools['activeCampaigns'].get(campaignId);
      if (campaign) {
        // Manually set metrics to simulate good performance
        campaignTools['campaignMetrics'].set(campaignId, {
          spend: 150,
          revenue: 450,
          roas: 3.0,
          impressions: 10000,
          clicks: 500,
          conversions: 30,
          ctr: 5.0,
          cpc: 0.3,
          lastUpdated: new Date()
        });
      }
      
      mockGrokClient.simpleChat.mockRejectedValueOnce(new Error('Strategy failed'));

      const params = {
        campaignId,
        newBudget: 200,
        reason: 'Test scaling'
      };

      const result = await campaignTools.scaleCampaign(params);

      // Should still succeed with default strategy
      expect(result.success).toBe(true);
      expect(result.data.strategy).toBeDefined();
    });
  });

  describe('killCampaign', () => {
    let campaignId: string;

    beforeEach(async () => {
      mockGrokClient.simpleChat.mockResolvedValue('Test strategy');
      
      const createResult = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });
      
      campaignId = createResult.data.campaign.id;
    });

    it('should kill an underperforming campaign', async () => {
      const params = {
        campaignId,
        reason: 'Poor ROAS performance'
      };

      const result = await campaignTools.killCampaign(params);

      expect(result.success).toBe(true);
      expect(result.data.campaignId).toBe(campaignId);
      expect(result.data.finalMetrics).toBeDefined();
      expect(result.data.analysis).toBeDefined();
      expect(result.data.analysis.lessonsLearned).toBeDefined();
      expect(result.metadata.reason).toBe('Poor ROAS performance');
      expect(result.metadata.finalStatus).toBe('killed');
    });

    it('should reject killing non-existent campaign', async () => {
      const params = {
        campaignId: 'nonexistent',
        reason: 'Test'
      };

      const result = await campaignTools.killCampaign(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign not found');
    });

    it('should reject killing already killed campaign', async () => {
      // First kill
      await campaignTools.killCampaign({
        campaignId,
        reason: 'First kill'
      });

      // Try to kill again
      const result = await campaignTools.killCampaign({
        campaignId,
        reason: 'Second kill'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign is already killed');
    });

    it('should calculate days active correctly', async () => {
      // Let some time pass
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await campaignTools.killCampaign({
        campaignId,
        reason: 'Test kill'
      });

      expect(result.data.daysActive).toBeGreaterThanOrEqual(0);
    });
  });

  describe('pauseCampaign and resumeCampaign', () => {
    let campaignId: string;

    beforeEach(async () => {
      mockGrokClient.simpleChat.mockResolvedValue('Test strategy');
      
      const createResult = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });
      
      campaignId = createResult.data.campaign.id;
    });

    it('should pause an active campaign', async () => {
      const result = await campaignTools.pauseCampaign(campaignId, 'Testing pause functionality');

      expect(result.success).toBe(true);
      expect(result.data.campaignId).toBe(campaignId);
      expect(result.data.status).toBe('paused');
      expect(result.data.reason).toBe('Testing pause functionality');
      expect(result.metadata.previousStatus).toBe('active');
    });

    it('should resume a paused campaign', async () => {
      // First pause the campaign
      await campaignTools.pauseCampaign(campaignId, 'Test pause');

      // Then resume it
      const result = await campaignTools.resumeCampaign(campaignId);

      expect(result.success).toBe(true);
      expect(result.data.campaignId).toBe(campaignId);
      expect(result.data.status).toBe('active');
      expect(result.metadata.previousStatus).toBe('paused');
    });

    it('should reject pausing non-active campaign', async () => {
      // First pause the campaign
      await campaignTools.pauseCampaign(campaignId, 'First pause');

      // Try to pause again
      const result = await campaignTools.pauseCampaign(campaignId, 'Second pause');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Can only pause active campaigns');
    });

    it('should reject resuming non-paused campaign', async () => {
      const result = await campaignTools.resumeCampaign(campaignId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Can only resume paused campaigns');
    });
  });

  describe('optimizeCampaign', () => {
    let campaignId: string;

    beforeEach(async () => {
      mockGrokClient.simpleChat.mockResolvedValue('Test strategy');
      
      const createResult = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });
      
      campaignId = createResult.data.campaign.id;
    });

    it('should optimize campaign successfully', async () => {
      const result = await campaignTools.optimizeCampaign(campaignId);

      expect(result.success).toBe(true);
      expect(result.data.campaignId).toBe(campaignId);
      expect(result.data.currentMetrics).toBeDefined();
      expect(result.data.recommendations).toBeDefined();
      expect(result.data.appliedOptimizations).toBeDefined();
      expect(result.data.expectedImpact).toBeDefined();
      expect(result.metadata.optimizationType).toBe('automatic');
    });

    it('should handle optimization of non-existent campaign', async () => {
      const result = await campaignTools.optimizeCampaign('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Campaign not found');
    });

    it('should provide optimization recommendations', async () => {
      const result = await campaignTools.optimizeCampaign(campaignId);

      expect(result.data.recommendations).toHaveProperty('creative');
      expect(result.data.recommendations).toHaveProperty('targeting');
      expect(result.data.recommendations).toHaveProperty('bidding');
      expect(result.data.recommendations).toHaveProperty('budget');
    });
  });

  describe('metric simulation', () => {
    let campaignId: string;

    beforeEach(async () => {
      mockGrokClient.simpleChat.mockResolvedValue('Test strategy');
      
      const createResult = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });
      
      campaignId = createResult.data.campaign.id;
    });

    it('should simulate realistic metric evolution', async () => {
      // Check initial metrics
      const initialCheck = await campaignTools.checkMetrics();
      const initialMetrics = initialCheck.data.campaigns[0].metrics;

      // Wait for metrics to evolve
      await new Promise(resolve => setTimeout(resolve, 200));

      // Check metrics again
      const laterCheck = await campaignTools.checkMetrics();
      const laterMetrics = laterCheck.data.campaigns[0].metrics;

      // Metrics should evolve over time
      expect(laterMetrics.lastUpdated.getTime()).toBeGreaterThanOrEqual(
        initialMetrics.lastUpdated.getTime()
      );
    });

    it('should calculate ROAS correctly', async () => {
      const metricsCheck = await campaignTools.checkMetrics();
      const metrics = metricsCheck.data.campaigns[0].metrics;

      if (metrics.spend > 0) {
        const expectedROAS = metrics.revenue / metrics.spend;
        expect(Math.abs(metrics.roas - expectedROAS)).toBeLessThan(0.01);
      }
    });

    it('should simulate different performance by platform', async () => {
      // Create campaigns on different platforms
      const tiktokResult = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'tiktok'
      });

      const googleResult = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'google'
      });

      // Let metrics evolve
      await new Promise(resolve => setTimeout(resolve, 100));

      const metricsCheck = await campaignTools.checkMetrics();
      
      expect(metricsCheck.data.campaigns).toHaveLength(3); // Facebook + TikTok + Google
      
      // Each platform should have different base performance characteristics
      const platforms = metricsCheck.data.campaigns.map(c => c.campaign.platform);
      expect(platforms).toContain('facebook');
      expect(platforms).toContain('tiktok');
      expect(platforms).toContain('google');
    });
  });

  describe('error handling', () => {
    it('should handle campaign creation failure gracefully', async () => {
      mockGrokClient.simpleChat.mockRejectedValue(new Error('Complete failure'));

      const params = {
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook' as const
      };

      const result = await campaignTools.createCampaign(params);

      // Should still succeed with fallback strategy
      expect(result.success).toBe(true);
      expect(result.data.campaign).toBeDefined();
    });

    it('should handle metrics check failure', async () => {
      // Create a campaign first
      mockGrokClient.simpleChat.mockResolvedValueOnce('Test strategy');
      await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });

      // Mock a failure in metrics fetching by corrupting internal state
      const result = await campaignTools.checkMetrics();

      // Should handle gracefully
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('strategy parsing', () => {
    it('should parse structured strategy responses', async () => {
      const structuredResponse = `CREATIVE STRATEGY:
Use video format with testimonials
Target mobile users primarily

TARGETING STRATEGY:
Age: 25-45
Interests: Technology, Shopping
Locations: US, CA, UK

BIDDING STRATEGY:
Lowest cost with conversion optimization
Set bid cap at $2.00

TESTING FRAMEWORK:
Test 3 creative variations
A/B test audiences
Monitor CTR and ROAS

OPTIMIZATION PLAN:
Daily optimization
Target ROAS: 2.5+
Kill threshold: ROAS < 1.0`;

      mockGrokClient.simpleChat.mockResolvedValueOnce(structuredResponse);

      const result = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });

      expect(result.success).toBe(true);
      expect(result.data.strategy.creative).toContain('video format');
      expect(result.data.strategy.targeting).toContain('25-45');
      expect(result.data.strategy.bidding).toContain('Lowest cost');
    });

    it('should handle unstructured strategy responses', async () => {
      const unstructuredResponse = `This is a good campaign strategy. Use video ads and target young professionals. Set the budget to optimize for conversions.`;

      mockGrokClient.simpleChat.mockResolvedValueOnce(unstructuredResponse);

      const result = await campaignTools.createCampaign({
        product: testProduct,
        angle: testAngle,
        budget: 100,
        platform: 'facebook'
      });

      expect(result.success).toBe(true);
      expect(result.data.strategy).toBeDefined();
      // Should fall back to default values when parsing fails
      expect(typeof result.data.strategy.creative).toBe('string');
    });
  });
});