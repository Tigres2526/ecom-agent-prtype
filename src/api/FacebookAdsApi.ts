import { z } from 'zod';
import { ApiClient } from './ApiClient.js';
import type { Campaign, MarketingAngle } from '../types/index.js';

// Facebook Ads API response schemas
const AdAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency: z.string(),
  account_status: z.number(),
  spend_cap: z.string().optional()
});

const CampaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED']),
  objective: z.string(),
  spend_cap: z.string().optional(),
  daily_budget: z.string().optional()
});

const AdSetSchema = z.object({
  id: z.string(),
  name: z.string(),
  campaign_id: z.string(),
  status: z.enum(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED']),
  daily_budget: z.string(),
  targeting: z.object({
    age_min: z.number().optional(),
    age_max: z.number().optional(),
    genders: z.array(z.number()).optional(),
    geo_locations: z.object({
      countries: z.array(z.string()).optional(),
      regions: z.array(z.object({
        key: z.string()
      })).optional()
    }).optional()
  })
});

const InsightsSchema = z.object({
  impressions: z.string(),
  clicks: z.string(),
  spend: z.string(),
  conversions: z.string().optional(),
  revenue: z.string().optional(),
  ctr: z.string(),
  cpc: z.string(),
  roas: z.string().optional()
});

/**
 * Facebook Ads API client
 */
export class FacebookAdsApi extends ApiClient {
  private accountId?: string;
  
  constructor(config: {
    accessToken?: string;
    accountId?: string;
    errorRecovery?: import('../agent/ErrorRecovery.js').ErrorRecovery;
  }) {
    super({
      baseUrl: 'https://graph.facebook.com/v18.0',
      apiKey: config.accessToken || process.env.FACEBOOK_ACCESS_TOKEN,
      errorRecovery: config.errorRecovery
    });
    
    this.accountId = config.accountId || process.env.FACEBOOK_AD_ACCOUNT_ID;
  }

  protected setAuthHeader(apiKey: string): void {
    // Facebook uses access token in query params or header
    this.headers['Authorization'] = `Bearer ${apiKey}`;
  }

  /**
   * Gets ad account information
   */
  public async getAdAccount(): Promise<any> {
    if (!this.accountId) {
      throw new Error('Facebook Ad Account ID not configured');
    }
    
    return this.get(
      `/act_${this.accountId}`,
      { fields: 'id,name,currency,account_status,spend_cap' },
      AdAccountSchema
    );
  }

  /**
   * Creates a new campaign
   */
  public async createCampaign(params: {
    name: string;
    objective: string;
    budget: number;
    angle: MarketingAngle;
  }): Promise<{ id: string; campaign: Campaign }> {
    if (!this.accountId) {
      throw new Error('Facebook Ad Account ID not configured');
    }
    
    // Create campaign
    const campaignResponse = await this.post(
      `/act_${this.accountId}/campaigns`,
      {
        name: params.name,
        objective: params.objective.toUpperCase(),
        status: 'PAUSED', // Start paused for safety
        special_ad_categories: [],
        daily_budget: Math.round(params.budget * 100) // Convert to cents
      }
    );
    
    // Create ad set with targeting
    const adSetResponse = await this.post(
      `/act_${this.accountId}/adsets`,
      {
        name: `${params.name} - AdSet`,
        campaign_id: (campaignResponse as any).id,
        daily_budget: Math.round(params.budget * 100),
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'CONVERSIONS',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: this.buildTargeting(params.angle),
        status: 'PAUSED'
      }
    );
    
    // Return structured campaign object
    return {
      id: (campaignResponse as any).id,
      campaign: {
        id: (campaignResponse as any).id,
        productId: params.angle.productId,
        platform: 'facebook',
        angle: params.angle.angle,
        budget: params.budget,
        spend: 0,
        revenue: 0,
        roas: 0,
        status: 'paused',
        createdDay: 0, // Will be set by caller
        lastOptimized: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0
      }
    };
  }

  /**
   * Gets campaign insights (metrics)
   */
  public async getCampaignInsights(
    campaignId: string,
    dateRange?: { start: string; end: string }
  ): Promise<any> {
    const params: any = {
      fields: 'impressions,clicks,spend,conversions,revenue,ctr,cpc,roas',
      level: 'campaign'
    };
    
    if (dateRange) {
      params.time_range = JSON.stringify({
        since: dateRange.start,
        until: dateRange.end
      });
    }
    
    const response = await this.get(
      `/${campaignId}/insights`,
      params
    );
    
    // Parse the insights data
    if ((response as any).data && (response as any).data.length > 0) {
      const insights = InsightsSchema.parse((response as any).data[0]);
      return {
        impressions: parseInt((insights as any).impressions),
        clicks: parseInt((insights as any).clicks),
        spend: parseFloat((insights as any).spend),
        conversions: (insights as any).conversions ? parseInt((insights as any).conversions) : 0,
        revenue: (insights as any).revenue ? parseFloat((insights as any).revenue) : 0,
        ctr: parseFloat((insights as any).ctr),
        cpc: parseFloat((insights as any).cpc),
        roas: (insights as any).roas ? parseFloat((insights as any).roas) : 0
      };
    }
    
    return {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      revenue: 0,
      ctr: 0,
      cpc: 0,
      roas: 0
    };
  }

  /**
   * Updates campaign status
   */
  public async updateCampaignStatus(
    campaignId: string,
    status: 'active' | 'paused' | 'archived'
  ): Promise<void> {
    const fbStatus = status.toUpperCase();
    
    await this.post(
      `/${campaignId}`,
      { status: fbStatus }
    );
  }

  /**
   * Updates campaign budget
   */
  public async updateCampaignBudget(
    campaignId: string,
    dailyBudget: number
  ): Promise<void> {
    // Get campaign details first
    const campaign = await this.get(`/${campaignId}`, {
      fields: 'adsets{id}'
    });
    
    // Update all ad sets in the campaign
    if ((campaign as any).adsets && (campaign as any).adsets.data) {
      for (const adSet of (campaign as any).adsets.data) {
        await this.post(
          `/${adSet.id}`,
          { daily_budget: Math.round(dailyBudget * 100) }
        );
      }
    }
  }

  /**
   * Gets all campaigns
   */
  public async getAllCampaigns(
    status?: 'active' | 'paused' | 'all'
  ): Promise<any[]> {
    if (!this.accountId) {
      throw new Error('Facebook Ad Account ID not configured');
    }
    
    const params: any = {
      fields: 'id,name,status,objective,daily_budget,spend_cap',
      limit: 100
    };
    
    if (status && status !== 'all') {
      params.filtering = JSON.stringify([{
        field: 'status',
        operator: 'EQUAL',
        value: status.toUpperCase()
      }]);
    }
    
    const response = await this.get(
      `/act_${this.accountId}/campaigns`,
      params
    );
    
    return (response as any).data || [];
  }

  /**
   * Builds targeting object from marketing angle
   */
  private buildTargeting(angle: MarketingAngle): any {
    // Parse target audience for demographic info
    const targeting: any = {
      geo_locations: {
        countries: ['US'] // Default to US
      }
    };
    
    // Extract age range if mentioned
    const ageMatch = angle.targetAudience.match(/(\d+)-(\d+)/);
    if (ageMatch) {
      targeting.age_min = parseInt(ageMatch[1]);
      targeting.age_max = parseInt(ageMatch[2]);
    }
    
    // Extract gender if mentioned
    if (angle.targetAudience.toLowerCase().includes('women') || 
        angle.targetAudience.toLowerCase().includes('female')) {
      targeting.genders = [2]; // Female
    } else if (angle.targetAudience.toLowerCase().includes('men') || 
               angle.targetAudience.toLowerCase().includes('male')) {
      targeting.genders = [1]; // Male
    }
    
    // Add interests based on pain points and solution
    targeting.interests = [];
    
    // Extract keywords from angle
    const keywords = [
      ...angle.painPoint.split(' '),
      ...angle.solution.split(' ')
    ].filter(word => word.length > 4); // Filter short words
    
    // Facebook interest targeting would need interest IDs
    // This is simplified for demonstration
    
    return targeting;
  }

  /**
   * Creates a creative (ad) for a campaign
   */
  public async createCreative(params: {
    adSetId: string;
    name: string;
    angle: MarketingAngle;
    imageUrl: string;
  }): Promise<any> {
    if (!this.accountId) {
      throw new Error('Facebook Ad Account ID not configured');
    }
    
    // Create the creative
    const creativeResponse = await this.post(
      `/act_${this.accountId}/adcreatives`,
      {
        name: params.name,
        title: params.angle.hook,
        body: params.angle.solution,
        call_to_action: {
          type: 'SHOP_NOW',
          value: {
            link: 'https://example.com' // Would be actual product URL
          }
        },
        image_url: params.imageUrl,
        object_story_spec: {
          page_id: process.env.FACEBOOK_PAGE_ID,
          link_data: {
            call_to_action: {
              type: 'SHOP_NOW'
            },
            link: 'https://example.com',
            message: params.angle.solution,
            name: params.angle.hook,
            picture: params.imageUrl
          }
        }
      }
    );
    
    // Create the ad
    const adResponse = await this.post(
      `/act_${this.accountId}/ads`,
      {
        name: `${params.name} - Ad`,
        adset_id: params.adSetId,
        creative: { creative_id: (creativeResponse as any).id },
        status: 'PAUSED'
      }
    );
    
    return {
      creativeId: (creativeResponse as any).id,
      adId: (adResponse as any).id
    };
  }

  /**
   * Gets account spending limit
   */
  public async getSpendingLimit(): Promise<{
    limit: number;
    spent: number;
    remaining: number;
  }> {
    const account = await this.getAdAccount();
    
    // Get current spend
    const insights = await this.get(
      `/act_${this.accountId}/insights`,
      {
        fields: 'spend',
        date_preset: 'this_month'
      }
    );
    
    const currentSpend = (insights as any).data?.[0]?.spend 
      ? parseFloat((insights as any).data[0].spend) 
      : 0;
    
    const limit = account.spend_cap 
      ? parseFloat(account.spend_cap) / 100 
      : Infinity;
    
    return {
      limit,
      spent: currentSpend,
      remaining: limit - currentSpend
    };
  }
}