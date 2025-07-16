import { z } from 'zod';
import { ApiClient } from './ApiClient.js';
import type { Campaign, MarketingAngle } from '../types/index.js';

// TikTok Ads API response schemas
const AdvertiserSchema = z.object({
  advertiser_id: z.string(),
  advertiser_name: z.string(),
  currency: z.string(),
  balance: z.number(),
  status: z.string()
});

const CampaignResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.object({
    campaign_id: z.string()
  }).optional()
});

const MetricsResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.object({
    list: z.array(z.object({
      dimensions: z.object({
        campaign_id: z.string(),
        stat_time_day: z.string()
      }),
      metrics: z.object({
        spend: z.string(),
        impressions: z.string(),
        clicks: z.string(),
        conversions: z.string(),
        cost_per_conversion: z.string(),
        conversion_rate: z.string(),
        ctr: z.string(),
        cpc: z.string()
      })
    }))
  }).optional()
});

/**
 * TikTok Ads API client
 */
export class TikTokAdsApi extends ApiClient {
  private advertiserId?: string;
  
  constructor(config: {
    accessToken?: string;
    advertiserId?: string;
    errorRecovery?: import('../agent/ErrorRecovery.js').ErrorRecovery;
  }) {
    super({
      baseUrl: 'https://business-api.tiktok.com/open_api/v1.3',
      apiKey: config.accessToken || process.env.TIKTOK_ACCESS_TOKEN,
      errorRecovery: config.errorRecovery
    });
    
    this.advertiserId = config.advertiserId || process.env.TIKTOK_ADVERTISER_ID;
  }

  protected setAuthHeader(apiKey: string): void {
    this.headers['Access-Token'] = apiKey;
  }

  /**
   * Gets advertiser information
   */
  public async getAdvertiser(): Promise<any> {
    if (!this.advertiserId) {
      throw new Error('TikTok Advertiser ID not configured');
    }
    
    const response = await this.get('/advertiser/info/', {
      advertiser_ids: JSON.stringify([this.advertiserId])
    });
    
    if ((response as any).code !== 0) {
      throw new Error(`TikTok API error: ${(response as any).message}`);
    }
    
    return (response as any).data?.list?.[0];
  }

  /**
   * Creates a new campaign
   */
  public async createCampaign(params: {
    name: string;
    budget: number;
    angle: MarketingAngle;
  }): Promise<{ id: string; campaign: Campaign }> {
    if (!this.advertiserId) {
      throw new Error('TikTok Advertiser ID not configured');
    }
    
    // Create campaign
    const campaignResponse = await this.post(
      '/campaign/create/',
      {
        advertiser_id: this.advertiserId,
        campaign_name: params.name,
        objective_type: 'CONVERSIONS',
        budget_mode: 'BUDGET_MODE_DAY',
        budget: params.budget,
        operation_status: 'DISABLE' // Start paused
      },
      CampaignResponseSchema
    );
    
    if (campaignResponse.code !== 0) {
      throw new Error(`Failed to create campaign: ${campaignResponse.message}`);
    }
    
    const campaignId = campaignResponse.data!.campaign_id;
    
    // Create ad group
    const adGroupResponse = await this.post('/adgroup/create/', {
      advertiser_id: this.advertiserId,
      campaign_id: campaignId,
      adgroup_name: `${params.name} - AdGroup`,
      placement_type: 'PLACEMENT_TYPE_AUTOMATIC',
      location_ids: ['6252001'], // US location ID
      gender: this.extractGender(params.angle),
      age_groups: this.extractAgeGroups(params.angle),
      budget_mode: 'BUDGET_MODE_DAY',
      budget: params.budget,
      schedule_type: 'SCHEDULE_FROM_NOW',
      optimize_goal: 'CONVERSIONS',
      billing_event: 'CPC',
      bid_type: 'BID_TYPE_CUSTOM',
      bid: 0.5, // Starting bid
      operation_status: 'DISABLE'
    });
    
    if ((adGroupResponse as any).code !== 0) {
      throw new Error(`Failed to create ad group: ${(adGroupResponse as any).message}`);
    }
    
    // Return structured campaign object
    return {
      id: campaignId,
      campaign: {
        id: campaignId,
        productId: params.angle.productId,
        platform: 'tiktok',
        angle: params.angle.angle,
        budget: params.budget,
        spend: 0,
        revenue: 0,
        roas: 0,
        status: 'paused',
        createdDay: 0,
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
   * Gets campaign metrics
   */
  public async getCampaignMetrics(
    campaignId: string,
    dateRange?: { start: string; end: string }
  ): Promise<any> {
    if (!this.advertiserId) {
      throw new Error('TikTok Advertiser ID not configured');
    }
    
    const params: any = {
      advertiser_id: this.advertiserId,
      data_level: 'AUCTION_CAMPAIGN',
      dimensions: JSON.stringify(['campaign_id', 'stat_time_day']),
      metrics: JSON.stringify([
        'spend', 'impressions', 'clicks', 'conversions',
        'cost_per_conversion', 'conversion_rate', 'ctr', 'cpc'
      ]),
      filters: JSON.stringify([{
        field_name: 'campaign_id',
        filter_type: 'IN',
        filter_value: JSON.stringify([campaignId])
      }])
    };
    
    if (dateRange) {
      params.start_date = dateRange.start;
      params.end_date = dateRange.end;
    } else {
      // Default to last 7 days
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      params.start_date = start.toISOString().split('T')[0];
      params.end_date = end.toISOString().split('T')[0];
    }
    
    const response = await this.get(
      '/reports/integrated/get/',
      params,
      MetricsResponseSchema
    );
    
    if ((response as any).code !== 0) {
      throw new Error(`Failed to get metrics: ${(response as any).message}`);
    }
    
    // Aggregate metrics
    const metrics = {
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      revenue: 0, // TikTok doesn't provide revenue directly
      ctr: 0,
      cpc: 0,
      roas: 0
    };
    
    if ((response as any).data?.list) {
      (response as any).data.list.forEach((item: any) => {
        metrics.impressions += parseInt(item.metrics.impressions);
        metrics.clicks += parseInt(item.metrics.clicks);
        metrics.spend += parseFloat(item.metrics.spend);
        metrics.conversions += parseInt(item.metrics.conversions);
      });
      
      // Calculate averages
      if ((response as any).data.list.length > 0) {
        metrics.ctr = metrics.clicks / metrics.impressions * 100;
        metrics.cpc = metrics.spend / metrics.clicks;
      }
    }
    
    return metrics;
  }

  /**
   * Updates campaign status
   */
  public async updateCampaignStatus(
    campaignId: string,
    status: 'active' | 'paused' | 'archived'
  ): Promise<void> {
    if (!this.advertiserId) {
      throw new Error('TikTok Advertiser ID not configured');
    }
    
    const operationStatus = status === 'active' ? 'ENABLE' : 'DISABLE';
    
    const response = await this.post('/campaign/update/', {
      advertiser_id: this.advertiserId,
      campaign_id: campaignId,
      operation_status: operationStatus
    });
    
    if ((response as any).code !== 0) {
      throw new Error(`Failed to update campaign: ${(response as any).message}`);
    }
  }

  /**
   * Updates campaign budget
   */
  public async updateCampaignBudget(
    campaignId: string,
    dailyBudget: number
  ): Promise<void> {
    if (!this.advertiserId) {
      throw new Error('TikTok Advertiser ID not configured');
    }
    
    const response = await this.post('/campaign/update/', {
      advertiser_id: this.advertiserId,
      campaign_id: campaignId,
      budget: dailyBudget
    });
    
    if ((response as any).code !== 0) {
      throw new Error(`Failed to update budget: ${(response as any).message}`);
    }
  }

  /**
   * Gets all campaigns
   */
  public async getAllCampaigns(
    status?: 'active' | 'paused' | 'all'
  ): Promise<any[]> {
    if (!this.advertiserId) {
      throw new Error('TikTok Advertiser ID not configured');
    }
    
    const params: any = {
      advertiser_id: this.advertiserId,
      page_size: 100
    };
    
    if (status && status !== 'all') {
      params.primary_status = status === 'active' ? 'STATUS_ENABLE' : 'STATUS_DISABLE';
    }
    
    const response = await this.get('/campaign/get/', params);
    
    if ((response as any).code !== 0) {
      throw new Error(`Failed to get campaigns: ${(response as any).message}`);
    }
    
    return (response as any).data?.list || [];
  }

  /**
   * Creates an ad creative
   */
  public async createCreative(params: {
    adGroupId: string;
    name: string;
    angle: MarketingAngle;
    videoUrl: string; // TikTok requires video
  }): Promise<any> {
    if (!this.advertiserId) {
      throw new Error('TikTok Advertiser ID not configured');
    }
    
    // Upload video first (simplified - would need actual upload)
    const videoId = 'mock_video_id'; // Would be from video upload
    
    // Create the ad
    const response = await this.post('/ad/create/', {
      advertiser_id: this.advertiserId,
      adgroup_id: params.adGroupId,
      creatives: [{
        ad_name: params.name,
        ad_text: params.angle.hook,
        call_to_action_text: params.angle.cta,
        video_id: videoId,
        display_name: 'Shop Now',
        landing_page_url: 'https://example.com', // Would be actual product URL
        creative_type: 'SINGLE_VIDEO'
      }],
      operation_status: 'DISABLE'
    });
    
    if ((response as any).code !== 0) {
      throw new Error(`Failed to create ad: ${(response as any).message}`);
    }
    
    return {
      adId: (response as any).data?.ad_ids?.[0]
    };
  }

  /**
   * Gets account balance
   */
  public async getAccountBalance(): Promise<{
    balance: number;
    currency: string;
  }> {
    const advertiser = await this.getAdvertiser();
    
    return {
      balance: advertiser.balance || 0,
      currency: advertiser.currency || 'USD'
    };
  }

  /**
   * Extracts gender from marketing angle
   */
  private extractGender(angle: MarketingAngle): string {
    const audience = angle.targetAudience.toLowerCase();
    
    if (audience.includes('women') || audience.includes('female')) {
      return 'GENDER_FEMALE';
    } else if (audience.includes('men') || audience.includes('male')) {
      return 'GENDER_MALE';
    }
    
    return 'GENDER_UNLIMITED';
  }

  /**
   * Extracts age groups from marketing angle
   */
  private extractAgeGroups(angle: MarketingAngle): string[] {
    const ageGroups = [];
    const audience = angle.targetAudience.toLowerCase();
    
    // TikTok age groups
    const ageRanges = {
      'AGE_13_17': [13, 17],
      'AGE_18_24': [18, 24],
      'AGE_25_34': [25, 34],
      'AGE_35_44': [35, 44],
      'AGE_45_54': [45, 54],
      'AGE_55_100': [55, 100]
    };
    
    // Try to extract age from audience description
    const ageMatch = audience.match(/(\d+)-(\d+)/);
    if (ageMatch) {
      const minAge = parseInt(ageMatch[1]);
      const maxAge = parseInt(ageMatch[2]);
      
      // Find matching age groups
      for (const [group, [min, max]] of Object.entries(ageRanges)) {
        if ((minAge >= min && minAge <= max) || 
            (maxAge >= min && maxAge <= max)) {
          ageGroups.push(group);
        }
      }
    }
    
    return ageGroups.length > 0 ? ageGroups : ['AGE_18_24', 'AGE_25_34']; // Default
  }

  /**
   * Pauses all campaigns (for emergency stop)
   */
  public async pauseAllCampaigns(): Promise<number> {
    const campaigns = await this.getAllCampaigns('active');
    let paused = 0;
    
    for (const campaign of campaigns) {
      try {
        await this.updateCampaignStatus(campaign.campaign_id, 'paused');
        paused++;
      } catch (error) {
        console.error(`Failed to pause campaign ${campaign.campaign_id}:`, error);
      }
    }
    
    return paused;
  }
}