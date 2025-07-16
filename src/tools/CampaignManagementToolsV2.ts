import { z } from 'zod';
import type { AgentState } from '../models/AgentState.js';
import { Campaign } from '../models/Campaign.js';
import type { MarketingAngle, ToolResult } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';
import type { GrokClient } from '../agent/GrokClient.js';
import { ApiManager } from '../api/ApiManager.js';
import type { ErrorRecovery } from '../agent/ErrorRecovery.js';

// Zod schemas for tool parameters
const CreateCampaignParamsSchema = z.object({
  product: z.object({
    id: z.string(),
    name: z.string(),
    sourceUrl: z.string(),
    supplierPrice: z.number(),
    recommendedPrice: z.number(),
    margin: z.number()
  }),
  angle: z.object({
    id: z.string(),
    productId: z.string(),
    angle: z.string(),
    targetAudience: z.string(),
    painPoint: z.string(),
    solution: z.string(),
    hook: z.string(),
    cta: z.string()
  }),
  budget: z.number().positive(),
  platform: z.enum(['facebook', 'tiktok', 'google']),
  audience: z.record(z.any()).optional()
});

/**
 * Enhanced campaign management tools with real API integration
 */
export class CampaignManagementToolsV2 {
  private grokClient: GrokClient;
  private apiManager: ApiManager;
  private agentState: AgentState;
  private useRealAPIs: boolean;
  
  constructor(
    grokClient: GrokClient,
    agentState: AgentState,
    errorRecovery?: ErrorRecovery,
    useRealAPIs: boolean = false
  ) {
    this.grokClient = grokClient;
    this.agentState = agentState;
    this.apiManager = new ApiManager(errorRecovery);
    this.useRealAPIs = useRealAPIs && this.checkAPICredentials();
  }

  /**
   * Checks if API credentials are available
   */
  private checkAPICredentials(): boolean {
    const hasFacebook = !!(process.env.FACEBOOK_ACCESS_TOKEN && process.env.FACEBOOK_AD_ACCOUNT_ID);
    const hasTikTok = !!(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID);
    
    if (!hasFacebook && !hasTikTok) {
      console.log('⚠️ No API credentials found, using simulation mode');
      return false;
    }
    
    console.log('✅ API credentials found, real API mode enabled');
    return true;
  }

  /**
   * Creates a new advertising campaign
   */
  public async createCampaign(
    product: any,
    angle: MarketingAngle,
    budget: number,
    platform: 'facebook' | 'tiktok' | 'google',
    audience?: Record<string, any>
  ): Promise<ToolResult> {
    try {
      // Validate parameters
      const params = CreateCampaignParamsSchema.parse({
        product,
        angle,
        budget,
        platform,
        audience
      });
      
      // Check budget availability
      const availableBudget = this.agentState.netWorth - this.agentState.totalSpend;
      if (budget > availableBudget) {
        return {
          success: false,
          error: `Insufficient budget. Available: $${availableBudget.toFixed(2)}, Requested: $${budget}`
        };
      }
      
      // Generate campaign name
      const campaignName = `${product.name} - ${angle.angle} - ${new Date().toISOString().split('T')[0]}`;
      
      let campaign: Campaign;
      
      if (this.useRealAPIs) {
        // Use real API to create campaign
        const apiResult = await this.apiManager.createCampaign({
          platform,
          name: campaignName,
          budget,
          angle,
          productUrl: product.sourceUrl
        });
        
        if (!apiResult.success || !apiResult.campaign) {
          return {
            success: false,
            error: apiResult.error || 'Failed to create campaign via API'
          };
        }
        
        // Create Campaign instance from API result
        const apiCampaign = apiResult.campaign;
        campaign = new Campaign({
          id: apiCampaign.id,
          productId: apiCampaign.productId,
          platform: apiCampaign.platform,
          angle: apiCampaign.angle,
          budget: apiCampaign.budget,
          spend: apiCampaign.spend,
          revenue: apiCampaign.revenue,
          roas: apiCampaign.roas,
          status: apiCampaign.status,
          createdDay: this.agentState.currentDay,
          lastOptimized: this.agentState.currentDay
        });
        
        // Copy optional metrics
        if (apiCampaign.impressions !== undefined) campaign.impressions = apiCampaign.impressions;
        if (apiCampaign.clicks !== undefined) campaign.clicks = apiCampaign.clicks;
        if (apiCampaign.conversions !== undefined) campaign.conversions = apiCampaign.conversions;
        if (apiCampaign.ctr !== undefined) campaign.ctr = apiCampaign.ctr;
        if (apiCampaign.cpc !== undefined) campaign.cpc = apiCampaign.cpc;
        
      } else {
        // Simulate campaign creation
        campaign = await this.simulateCampaignCreation({
          name: campaignName,
          product,
          angle,
          budget,
          platform
        });
      }
      
      // Add campaign to agent state
      this.agentState.addCampaign(campaign);
      
      // Generate strategy recommendations
      const strategy = await this.generateCampaignStrategy({
        product,
        angle,
        budget,
        platform
      });
      
      return {
        success: true,
        data: {
          campaign,
          strategy,
          apiMode: this.useRealAPIs ? 'real' : 'simulation',
          estimatedReach: this.estimateReach(budget, platform),
          expectedROAS: this.estimateROAS(platform, angle)
        }
      };
      
    } catch (error) {
      console.error('Campaign creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Checks campaign metrics
   */
  public async checkMetrics(campaignId?: string): Promise<ToolResult> {
    try {
      const campaigns = campaignId 
        ? [this.agentState.activeCampaigns.find(c => c.id === campaignId)].filter(Boolean)
        : this.agentState.activeCampaigns;
        
      if (campaigns.length === 0) {
        return {
          success: false,
          error: campaignId ? 'Campaign not found' : 'No active campaigns'
        };
      }
      
      const metricsResults = [];
      let totalSpend = 0;
      let totalRevenue = 0;
      
      for (const campaign of campaigns) {
        let metrics;
        
        if (!campaign) continue; // Skip if campaign is undefined
        
        if (this.useRealAPIs && campaign.platform !== 'google') {
          // Fetch real metrics from API
          const apiResult = await this.apiManager.getCampaignMetrics(
            campaign.platform as 'facebook' | 'tiktok',
            campaign.id
          );
          
          if (apiResult.success && apiResult.metrics) {
            metrics = apiResult.metrics;
            
            // Update campaign with real metrics
            campaign.spend = metrics.spend;
            campaign.revenue = metrics.revenue;
            campaign.roas = metrics.roas;
            campaign.impressions = metrics.impressions;
            campaign.clicks = metrics.clicks;
            campaign.conversions = metrics.conversions;
            campaign.ctr = metrics.ctr;
            campaign.cpc = metrics.cpc;
          } else {
            // Fall back to simulation if API fails
            metrics = this.simulateCampaignMetrics(campaign);
          }
        } else {
          // Use simulated metrics
          metrics = this.simulateCampaignMetrics(campaign);
        }
        
        totalSpend += metrics.spend;
        totalRevenue += metrics.revenue;
        
        metricsResults.push({
          campaign: {
            id: campaign.id,
            platform: campaign.platform,
            angle: campaign.angle,
            status: campaign.status
          },
          metrics,
          performance: this.evaluatePerformance(metrics)
        });
      }
      
      return {
        success: true,
        data: {
          campaigns: metricsResults,
          summary: {
            totalCampaigns: campaigns.length,
            totalSpend,
            totalRevenue,
            averageROAS: totalSpend > 0 ? totalRevenue / totalSpend : 0,
            apiMode: this.useRealAPIs ? 'real' : 'simulation'
          },
          recommendations: this.generateMetricsRecommendations(metricsResults)
        }
      };
      
    } catch (error) {
      console.error('Metrics check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Scales a campaign budget
   */
  public async scaleCampaign(
    campaignId: string,
    newBudget: number,
    reason: string
  ): Promise<ToolResult> {
    try {
      const campaign = this.agentState.activeCampaigns.find(c => c.id === campaignId);
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found'
        };
      }
      
      if (campaign.status !== 'active') {
        return {
          success: false,
          error: 'Can only scale active campaigns'
        };
      }
      
      if (newBudget <= campaign.budget) {
        return {
          success: false,
          error: 'New budget must be higher than current budget'
        };
      }
      
      // Check if campaign is profitable enough to scale
      if (campaign.roas < 1.5) {
        return {
          success: false,
          error: `Campaign ROAS (${campaign.roas.toFixed(2)}) too low for scaling. Minimum 1.5 required.`
        };
      }
      
      const oldBudget = campaign.budget;
      
      if (this.useRealAPIs && campaign.platform !== 'google') {
        // Update budget via API
        const apiResult = await this.apiManager.updateCampaignBudget(
          campaign.platform as 'facebook' | 'tiktok',
          campaign.id,
          newBudget
        );
        
        if (!apiResult.success) {
          return {
            success: false,
            error: apiResult.error || 'Failed to update campaign budget via API'
          };
        }
      }
      
      // Update local state
      campaign.budget = newBudget;
      campaign.lastOptimized = this.agentState.currentDay;
      
      // Generate scaling strategy
      const strategy = await this.generateScalingStrategy(campaign, oldBudget, newBudget);
      
      return {
        success: true,
        data: {
          campaignId,
          oldBudget,
          newBudget,
          scalingFactor: newBudget / oldBudget,
          reason,
          strategy,
          apiMode: this.useRealAPIs ? 'real' : 'simulation'
        }
      };
      
    } catch (error) {
      console.error('Campaign scaling failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Kills a campaign
   */
  public async killCampaign(campaignId: string, reason: string): Promise<ToolResult> {
    try {
      const campaign = this.agentState.activeCampaigns.find(c => c.id === campaignId);
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found'
        };
      }
      
      if (campaign.status === 'killed') {
        return {
          success: false,
          error: 'Campaign is already killed'
        };
      }
      
      if (this.useRealAPIs && campaign.platform !== 'google') {
        // Pause campaign via API (equivalent to killing)
        const apiResult = await this.apiManager.updateCampaignStatus(
          campaign.platform as 'facebook' | 'tiktok',
          campaign.id,
          'paused'
        );
        
        if (!apiResult.success) {
          return {
            success: false,
            error: apiResult.error || 'Failed to kill campaign via API'
          };
        }
      }
      
      // Update local state
      campaign.status = 'killed';
      campaign.lastOptimized = this.agentState.currentDay;
      
      // Calculate final metrics
      const finalMetrics = {
        totalSpend: campaign.spend,
        totalRevenue: campaign.revenue,
        finalROAS: campaign.roas,
        daysActive: this.agentState.currentDay - campaign.createdDay,
        profit: campaign.revenue - campaign.spend
      };
      
      return {
        success: true,
        data: {
          campaignId,
          reason,
          finalMetrics,
          lessonsLearned: this.generateLessonsLearned(campaign, reason),
          apiMode: this.useRealAPIs ? 'real' : 'simulation'
        }
      };
      
    } catch (error) {
      console.error('Campaign kill failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Pauses a campaign
   */
  public async pauseCampaign(campaignId: string, reason: string): Promise<ToolResult> {
    try {
      const campaign = this.agentState.activeCampaigns.find(c => c.id === campaignId);
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found'
        };
      }
      
      if (campaign.status !== 'active') {
        return {
          success: false,
          error: 'Can only pause active campaigns'
        };
      }
      
      if (this.useRealAPIs && campaign.platform !== 'google') {
        const apiResult = await this.apiManager.updateCampaignStatus(
          campaign.platform as 'facebook' | 'tiktok',
          campaign.id,
          'paused'
        );
        
        if (!apiResult.success) {
          return {
            success: false,
            error: apiResult.error || 'Failed to pause campaign via API'
          };
        }
      }
      
      campaign.status = 'paused';
      campaign.lastOptimized = this.agentState.currentDay;
      
      return {
        success: true,
        data: {
          campaignId,
          status: 'paused',
          reason,
          apiMode: this.useRealAPIs ? 'real' : 'simulation'
        }
      };
      
    } catch (error) {
      console.error('Campaign pause failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resumes a campaign
   */
  public async resumeCampaign(campaignId: string): Promise<ToolResult> {
    try {
      const campaign = this.agentState.activeCampaigns.find(c => c.id === campaignId);
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found'
        };
      }
      
      if (campaign.status !== 'paused') {
        return {
          success: false,
          error: 'Can only resume paused campaigns'
        };
      }
      
      if (this.useRealAPIs && campaign.platform !== 'google') {
        const apiResult = await this.apiManager.updateCampaignStatus(
          campaign.platform as 'facebook' | 'tiktok',
          campaign.id,
          'active'
        );
        
        if (!apiResult.success) {
          return {
            success: false,
            error: apiResult.error || 'Failed to resume campaign via API'
          };
        }
      }
      
      campaign.status = 'active';
      campaign.lastOptimized = this.agentState.currentDay;
      
      return {
        success: true,
        data: {
          campaignId,
          status: 'active',
          apiMode: this.useRealAPIs ? 'real' : 'simulation'
        }
      };
      
    } catch (error) {
      console.error('Campaign resume failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Emergency stop - pauses all campaigns
   */
  public async emergencyStop(): Promise<ToolResult> {
    try {
      const results = {
        paused: 0,
        failed: 0,
        campaigns: [] as any[]
      };
      
      if (this.useRealAPIs) {
        // Use API manager's emergency stop
        const apiResults = await this.apiManager.emergencyStop();
        results.paused = apiResults.total;
        
        // Also pause local campaigns
        for (const campaign of this.agentState.activeCampaigns) {
          if (campaign.status === 'active') {
            campaign.status = 'paused';
            results.campaigns.push({
              id: campaign.id,
              platform: campaign.platform,
              status: 'paused'
            });
          }
        }
      } else {
        // Simulate emergency stop
        for (const campaign of this.agentState.activeCampaigns) {
          if (campaign.status === 'active') {
            campaign.status = 'paused';
            results.paused++;
            results.campaigns.push({
              id: campaign.id,
              platform: campaign.platform,
              status: 'paused'
            });
          }
        }
      }
      
      return {
        success: true,
        data: {
          ...results,
          message: `Emergency stop executed. ${results.paused} campaigns paused.`,
          apiMode: this.useRealAPIs ? 'real' : 'simulation'
        }
      };
      
    } catch (error) {
      console.error('Emergency stop failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper methods
   */
  private async simulateCampaignCreation(params: any): Promise<Campaign> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const campaign = new Campaign({
      id: uuidv4(),
      productId: params.product.id,
      platform: params.platform,
      angle: params.angle.angle,
      budget: params.budget,
      spend: 0,
      revenue: 0,
      roas: 0,
      status: 'active',
      createdDay: this.agentState.currentDay,
      lastOptimized: this.agentState.currentDay
    });
    
    // Set optional metrics
    campaign.impressions = 0;
    campaign.clicks = 0;
    campaign.conversions = 0;
    campaign.ctr = 0;
    campaign.cpc = 0;
    
    return campaign;
  }

  private simulateCampaignMetrics(campaign: Campaign): any {
    const daysRunning = Math.max(1, this.agentState.currentDay - campaign.createdDay);
    const dailyBudget = campaign.budget / 7;
    
    // Simulate spend (80-100% of budget utilization)
    const utilization = 0.8 + Math.random() * 0.2;
    const spend = Math.min(dailyBudget * daysRunning * utilization, campaign.budget);
    
    // Simulate ROAS based on platform and days running
    let baseROAS = 1.5;
    if (campaign.platform === 'tiktok') baseROAS = 2.0;
    if (campaign.platform === 'facebook') baseROAS = 1.8;
    
    // ROAS improves over time (learning phase)
    const learningBonus = Math.min(0.5, daysRunning * 0.1);
    const roas = baseROAS + learningBonus + (Math.random() - 0.5) * 0.5;
    
    const revenue = spend * roas;
    
    // Update campaign object
    campaign.spend = spend;
    campaign.revenue = revenue;
    campaign.roas = roas;
    
    // Simulate other metrics
    campaign.impressions = Math.floor(spend * 1000);
    campaign.clicks = Math.floor(campaign.impressions * 0.02); // 2% CTR
    campaign.conversions = Math.floor(revenue / 50); // $50 AOV
    campaign.ctr = 2.0;
    campaign.cpc = campaign.clicks > 0 ? spend / campaign.clicks : 0;
    
    return {
      spend,
      revenue,
      roas,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      conversions: campaign.conversions,
      ctr: campaign.ctr,
      cpc: campaign.cpc
    };
  }

  private evaluatePerformance(metrics: any): string {
    if (metrics.roas >= 3.0) return 'excellent';
    if (metrics.roas >= 2.0) return 'good';
    if (metrics.roas >= 1.5) return 'acceptable';
    if (metrics.roas >= 1.0) return 'break-even';
    return 'poor';
  }

  private generateMetricsRecommendations(results: any[]): string[] {
    const recommendations = [];
    
    const poorPerformers = results.filter(r => r.performance === 'poor');
    if (poorPerformers.length > 0) {
      recommendations.push(`Kill ${poorPerformers.length} underperforming campaigns`);
    }
    
    const excellentPerformers = results.filter(r => r.performance === 'excellent');
    if (excellentPerformers.length > 0) {
      recommendations.push(`Scale ${excellentPerformers.length} high-performing campaigns`);
    }
    
    const lowSpenders = results.filter(r => r.metrics.spend < 50);
    if (lowSpenders.length > 0) {
      recommendations.push(`Wait for more data on ${lowSpenders.length} new campaigns`);
    }
    
    return recommendations;
  }

  private async generateCampaignStrategy(params: any): Promise<any> {
    const prompt = `Generate a campaign strategy for:
Product: ${params.product.name}
Platform: ${params.platform}
Angle: ${params.angle.angle}
Budget: $${params.budget}

Provide:
1. Creative recommendations
2. Targeting strategy
3. Bidding approach
4. Success metrics`;

    try {
      const response = await this.grokClient.simpleChat(
        'You are a performance marketing expert.',
        prompt
      );
      
      return {
        creative: 'Use video format with problem-solution narrative',
        targeting: params.angle.targetAudience,
        bidding: 'Start with automatic bidding',
        metrics: 'Monitor ROAS, CTR, and CPC daily'
      };
    } catch (error) {
      return {
        creative: 'Standard creative approach',
        targeting: 'Broad targeting',
        bidding: 'Automatic bidding',
        metrics: 'Standard metrics'
      };
    }
  }

  private async generateScalingStrategy(campaign: Campaign, oldBudget: number, newBudget: number): Promise<any> {
    const scalingFactor = newBudget / oldBudget;
    
    return {
      approach: scalingFactor > 2 ? 'gradual' : 'immediate',
      timeline: scalingFactor > 2 ? '5-7 days' : 'immediate',
      risks: scalingFactor > 2 ? ['audience fatigue', 'increased CPA'] : ['minimal'],
      recommendations: [
        'Monitor performance closely',
        'Be ready to adjust if ROAS drops',
        'Consider testing new creatives'
      ]
    };
  }

  private generateLessonsLearned(campaign: Campaign, reason: string): string[] {
    const lessons = [];
    
    if (campaign.roas < 1.0) {
      lessons.push('Product-market fit may be weak');
      lessons.push('Consider different targeting approach');
    }
    
    if (campaign.ctr !== undefined && campaign.ctr < 1.0) {
      lessons.push('Creative was not compelling enough');
      lessons.push('Test more engaging hooks');
    }
    
    if (campaign.conversions !== undefined && campaign.conversions < 10) {
      lessons.push('Landing page may need optimization');
      lessons.push('Price point might be too high');
    }
    
    if (reason.includes('budget')) {
      lessons.push('Set stricter budget controls');
      lessons.push('Kill campaigns faster if underperforming');
    }
    
    return lessons;
  }

  private estimateReach(budget: number, platform: string): number {
    let cpm = 10; // Cost per 1000 impressions
    
    if (platform === 'facebook') cpm = 8;
    if (platform === 'tiktok') cpm = 5;
    if (platform === 'google') cpm = 15;
    
    return Math.floor((budget / cpm) * 1000);
  }

  private estimateROAS(platform: string, angle: MarketingAngle): number {
    let baseROAS = 1.5;
    
    if (platform === 'tiktok') baseROAS = 2.0;
    if (platform === 'facebook') baseROAS = 1.8;
    
    // Adjust based on angle quality indicators
    if (angle.painPoint.length > 50) baseROAS += 0.2;
    if (angle.solution.length > 50) baseROAS += 0.2;
    if (angle.hook.length > 20) baseROAS += 0.1;
    
    return Math.round(baseROAS * 100) / 100;
  }
}