import { FacebookAdsApi } from './FacebookAdsApi.js';
import { TikTokAdsApi } from './TikTokAdsApi.js';
import type { ErrorRecovery } from '../agent/ErrorRecovery.js';
import type { Campaign, MarketingAngle } from '../types/index.js';

/**
 * Manages all external API integrations
 */
export class ApiManager {
  private facebookApi?: FacebookAdsApi;
  private tiktokApi?: TikTokAdsApi;
  private errorRecovery?: ErrorRecovery;
  private initialized: boolean = false;
  
  constructor(errorRecovery?: ErrorRecovery) {
    this.errorRecovery = errorRecovery;
  }

  /**
   * Initializes API clients based on available credentials
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Initialize Facebook Ads API if credentials available
    if (process.env.FACEBOOK_ACCESS_TOKEN && process.env.FACEBOOK_AD_ACCOUNT_ID) {
      this.facebookApi = new FacebookAdsApi({
        errorRecovery: this.errorRecovery
      });
      
      try {
        await this.facebookApi.getAdAccount();
        console.log('✅ Facebook Ads API initialized');
      } catch (error) {
        console.error('❌ Failed to initialize Facebook Ads API:', error);
        this.facebookApi = undefined;
      }
    }
    
    // Initialize TikTok Ads API if credentials available
    if (process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_ADVERTISER_ID) {
      this.tiktokApi = new TikTokAdsApi({
        errorRecovery: this.errorRecovery
      });
      
      try {
        await this.tiktokApi.getAdvertiser();
        console.log('✅ TikTok Ads API initialized');
      } catch (error) {
        console.error('❌ Failed to initialize TikTok Ads API:', error);
        this.tiktokApi = undefined;
      }
    }
    
    this.initialized = true;
  }

  /**
   * Creates a campaign on the specified platform
   */
  public async createCampaign(params: {
    platform: 'facebook' | 'tiktok' | 'google';
    name: string;
    budget: number;
    angle: MarketingAngle;
    productUrl?: string;
  }): Promise<{ success: boolean; campaign?: Campaign; error?: string }> {
    await this.initialize();
    
    try {
      switch (params.platform) {
        case 'facebook':
          if (!this.facebookApi) {
            return {
              success: false,
              error: 'Facebook Ads API not configured'
            };
          }
          
          const fbResult = await this.facebookApi.createCampaign({
            name: params.name,
            objective: 'CONVERSIONS',
            budget: params.budget,
            angle: params.angle
          });
          
          return {
            success: true,
            campaign: fbResult.campaign
          };
          
        case 'tiktok':
          if (!this.tiktokApi) {
            return {
              success: false,
              error: 'TikTok Ads API not configured'
            };
          }
          
          const ttResult = await this.tiktokApi.createCampaign({
            name: params.name,
            budget: params.budget,
            angle: params.angle
          });
          
          return {
            success: true,
            campaign: ttResult.campaign
          };
          
        case 'google':
          // Google Ads API would be implemented similarly
          return {
            success: false,
            error: 'Google Ads API not yet implemented'
          };
          
        default:
          return {
            success: false,
            error: `Unsupported platform: ${params.platform}`
          };
      }
    } catch (error) {
      console.error(`Failed to create campaign on ${params.platform}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets campaign metrics from the platform
   */
  public async getCampaignMetrics(
    platform: 'facebook' | 'tiktok' | 'google',
    campaignId: string,
    dateRange?: { start: string; end: string }
  ): Promise<{
    success: boolean;
    metrics?: {
      impressions: number;
      clicks: number;
      spend: number;
      conversions: number;
      revenue: number;
      ctr: number;
      cpc: number;
      roas: number;
    };
    error?: string;
  }> {
    await this.initialize();
    
    try {
      switch (platform) {
        case 'facebook':
          if (!this.facebookApi) {
            return {
              success: false,
              error: 'Facebook Ads API not configured'
            };
          }
          
          const fbMetrics = await this.facebookApi.getCampaignInsights(
            campaignId,
            dateRange
          );
          
          return {
            success: true,
            metrics: fbMetrics
          };
          
        case 'tiktok':
          if (!this.tiktokApi) {
            return {
              success: false,
              error: 'TikTok Ads API not configured'
            };
          }
          
          const ttMetrics = await this.tiktokApi.getCampaignMetrics(
            campaignId,
            dateRange
          );
          
          return {
            success: true,
            metrics: ttMetrics
          };
          
        case 'google':
          return {
            success: false,
            error: 'Google Ads API not yet implemented'
          };
          
        default:
          return {
            success: false,
            error: `Unsupported platform: ${platform}`
          };
      }
    } catch (error) {
      console.error(`Failed to get metrics from ${platform}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Updates campaign status
   */
  public async updateCampaignStatus(
    platform: 'facebook' | 'tiktok' | 'google',
    campaignId: string,
    status: 'active' | 'paused' | 'archived'
  ): Promise<{ success: boolean; error?: string }> {
    await this.initialize();
    
    try {
      switch (platform) {
        case 'facebook':
          if (!this.facebookApi) {
            return {
              success: false,
              error: 'Facebook Ads API not configured'
            };
          }
          
          await this.facebookApi.updateCampaignStatus(campaignId, status);
          return { success: true };
          
        case 'tiktok':
          if (!this.tiktokApi) {
            return {
              success: false,
              error: 'TikTok Ads API not configured'
            };
          }
          
          await this.tiktokApi.updateCampaignStatus(campaignId, status);
          return { success: true };
          
        case 'google':
          return {
            success: false,
            error: 'Google Ads API not yet implemented'
          };
          
        default:
          return {
            success: false,
            error: `Unsupported platform: ${platform}`
          };
      }
    } catch (error) {
      console.error(`Failed to update campaign status on ${platform}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Updates campaign budget
   */
  public async updateCampaignBudget(
    platform: 'facebook' | 'tiktok' | 'google',
    campaignId: string,
    dailyBudget: number
  ): Promise<{ success: boolean; error?: string }> {
    await this.initialize();
    
    try {
      switch (platform) {
        case 'facebook':
          if (!this.facebookApi) {
            return {
              success: false,
              error: 'Facebook Ads API not configured'
            };
          }
          
          await this.facebookApi.updateCampaignBudget(campaignId, dailyBudget);
          return { success: true };
          
        case 'tiktok':
          if (!this.tiktokApi) {
            return {
              success: false,
              error: 'TikTok Ads API not configured'
            };
          }
          
          await this.tiktokApi.updateCampaignBudget(campaignId, dailyBudget);
          return { success: true };
          
        case 'google':
          return {
            success: false,
            error: 'Google Ads API not yet implemented'
          };
          
        default:
          return {
            success: false,
            error: `Unsupported platform: ${platform}`
          };
      }
    } catch (error) {
      console.error(`Failed to update campaign budget on ${platform}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Gets all campaigns from all platforms
   */
  public async getAllCampaigns(
    status?: 'active' | 'paused' | 'all'
  ): Promise<{
    facebook: Campaign[];
    tiktok: Campaign[];
    google: Campaign[];
  }> {
    await this.initialize();
    
    const results: {
      facebook: Campaign[];
      tiktok: Campaign[];
      google: Campaign[];
    } = {
      facebook: [],
      tiktok: [],
      google: []
    };
    
    // Get Facebook campaigns
    if (this.facebookApi) {
      try {
        results.facebook = await this.facebookApi.getAllCampaigns(status);
      } catch (error) {
        console.error('Failed to get Facebook campaigns:', error);
      }
    }
    
    // Get TikTok campaigns
    if (this.tiktokApi) {
      try {
        results.tiktok = await this.tiktokApi.getAllCampaigns(status);
      } catch (error) {
        console.error('Failed to get TikTok campaigns:', error);
      }
    }
    
    return results;
  }

  /**
   * Gets spending limits from all platforms
   */
  public async getSpendingLimits(): Promise<{
    facebook?: { limit: number; spent: number; remaining: number };
    tiktok?: { balance: number; currency: string };
  }> {
    await this.initialize();
    
    const limits: any = {};
    
    // Get Facebook spending limit
    if (this.facebookApi) {
      try {
        limits.facebook = await this.facebookApi.getSpendingLimit();
      } catch (error) {
        console.error('Failed to get Facebook spending limit:', error);
      }
    }
    
    // Get TikTok balance
    if (this.tiktokApi) {
      try {
        limits.tiktok = await this.tiktokApi.getAccountBalance();
      } catch (error) {
        console.error('Failed to get TikTok balance:', error);
      }
    }
    
    return limits;
  }

  /**
   * Emergency stop - pauses all active campaigns
   */
  public async emergencyStop(): Promise<{
    facebook: number;
    tiktok: number;
    google: number;
    total: number;
  }> {
    await this.initialize();
    
    const paused = {
      facebook: 0,
      tiktok: 0,
      google: 0,
      total: 0
    };
    
    // Pause Facebook campaigns
    if (this.facebookApi) {
      try {
        const fbCampaigns = await this.facebookApi.getAllCampaigns('active');
        for (const campaign of fbCampaigns) {
          try {
            await this.facebookApi.updateCampaignStatus(campaign.id, 'paused');
            paused.facebook++;
          } catch (error) {
            console.error(`Failed to pause Facebook campaign ${campaign.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Failed to get Facebook campaigns for emergency stop:', error);
      }
    }
    
    // Pause TikTok campaigns
    if (this.tiktokApi) {
      try {
        paused.tiktok = await this.tiktokApi.pauseAllCampaigns();
      } catch (error) {
        console.error('Failed to pause TikTok campaigns:', error);
      }
    }
    
    paused.total = paused.facebook + paused.tiktok + paused.google;
    
    return paused;
  }

  /**
   * Checks if a platform is available
   */
  public isPlatformAvailable(platform: 'facebook' | 'tiktok' | 'google'): boolean {
    switch (platform) {
      case 'facebook':
        return this.facebookApi !== undefined;
      case 'tiktok':
        return this.tiktokApi !== undefined;
      case 'google':
        return false; // Not yet implemented
      default:
        return false;
    }
  }

  /**
   * Gets available platforms
   */
  public getAvailablePlatforms(): Array<'facebook' | 'tiktok' | 'google'> {
    const platforms: Array<'facebook' | 'tiktok' | 'google'> = [];
    
    if (this.facebookApi) platforms.push('facebook');
    if (this.tiktokApi) platforms.push('tiktok');
    // if (this.googleApi) platforms.push('google');
    
    return platforms;
  }
}