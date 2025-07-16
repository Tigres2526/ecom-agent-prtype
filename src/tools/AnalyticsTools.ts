import type { ToolResult } from '../types/index.js';
import type { AgentState } from '../models/AgentState.js';
import type { Campaign } from '../models/Campaign.js';
import type { Product } from '../models/Product.js';

/**
 * Analytics and reporting tools for the dropshipping agent
 */
export class AnalyticsTools {
  private agentState: AgentState;

  constructor(agentState: AgentState) {
    this.agentState = agentState;
  }

  /**
   * Analyze overall business performance
   */
  public async analyzePerformance(
    timeframe: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'all',
    metrics?: ('revenue' | 'spend' | 'roas' | 'profit' | 'conversion')[]
  ): Promise<ToolResult> {
    try {
      const currentDay = this.agentState.currentDay;
      let startDay: number;
      
      switch (timeframe) {
        case 'today':
          startDay = currentDay;
          break;
        case 'yesterday':
          startDay = Math.max(1, currentDay - 1);
          break;
        case 'last7days':
          startDay = Math.max(1, currentDay - 6);
          break;
        case 'last30days':
          startDay = Math.max(1, currentDay - 29);
          break;
        case 'all':
          startDay = 1;
          break;
      }
      
      // Get campaigns in timeframe
      const campaigns = this.agentState.activeCampaigns.filter(
        campaign => campaign.createdDay >= startDay
      );
      
      // Calculate metrics
      const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
      const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
      const overallROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const profit = totalRevenue - totalSpend;
      
      // Campaign performance breakdown
      const campaignMetrics = campaigns.map(campaign => ({
        id: campaign.id,
        product: campaign.productId,
        platform: campaign.platform,
        angle: campaign.angle,
        revenue: campaign.revenue,
        spend: campaign.spend,
        roas: campaign.roas,
        status: campaign.status,
        daysRunning: currentDay - campaign.createdDay,
      }));
      
      // Best and worst performers
      const sortedByROAS = [...campaigns].sort((a, b) => b.roas - a.roas);
      const bestCampaign = sortedByROAS[0];
      const worstCampaign = sortedByROAS[sortedByROAS.length - 1];
      
      // Product performance
      const productPerformance = this.calculateProductPerformance(campaigns);
      
      // Platform breakdown
      const platformBreakdown = this.calculatePlatformBreakdown(campaigns);
      
      const selectedMetrics = metrics || ['revenue', 'spend', 'roas', 'profit'];
      const result: any = {
        timeframe,
        period: {
          startDay,
          endDay: currentDay,
          days: currentDay - startDay + 1,
        },
      };
      
      if (selectedMetrics.includes('revenue')) {
        result.revenue = {
          total: totalRevenue,
          daily: totalRevenue / (currentDay - startDay + 1),
        };
      }
      
      if (selectedMetrics.includes('spend')) {
        result.spend = {
          total: totalSpend,
          daily: totalSpend / (currentDay - startDay + 1),
        };
      }
      
      if (selectedMetrics.includes('roas')) {
        result.roas = overallROAS;
      }
      
      if (selectedMetrics.includes('profit')) {
        result.profit = {
          total: profit,
          margin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
        };
      }
      
      result.campaigns = {
        total: campaigns.length,
        active: campaigns.filter(c => c.status === 'active').length,
        metrics: campaignMetrics,
      };
      
      if (bestCampaign) {
        result.bestPerformer = {
          campaign: bestCampaign.id,
          platform: bestCampaign.platform,
          roas: bestCampaign.roas,
          revenue: bestCampaign.revenue,
        };
      }
      
      if (worstCampaign && campaigns.length > 1) {
        result.worstPerformer = {
          campaign: worstCampaign.id,
          platform: worstCampaign.platform,
          roas: worstCampaign.roas,
          revenue: worstCampaign.revenue,
        };
      }
      
      result.productPerformance = productPerformance;
      result.platformBreakdown = platformBreakdown;
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to analyze performance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Generate a comprehensive business report
   */
  public async generateReport(
    type: 'daily' | 'weekly' | 'monthly' | 'custom',
    startDate?: string,
    endDate?: string
  ): Promise<ToolResult> {
    try {
      const currentDay = this.agentState.currentDay;
      let startDay: number;
      let endDay: number;
      
      switch (type) {
        case 'daily':
          startDay = currentDay;
          endDay = currentDay;
          break;
        case 'weekly':
          startDay = Math.max(1, currentDay - 6);
          endDay = currentDay;
          break;
        case 'monthly':
          startDay = Math.max(1, currentDay - 29);
          endDay = currentDay;
          break;
        case 'custom':
          if (!startDate || !endDate) {
            throw new Error('Start and end dates required for custom reports');
          }
          // For simplicity, using day numbers instead of dates
          startDay = parseInt(startDate);
          endDay = parseInt(endDate);
          break;
      }
      
      // Financial summary
      const financialHealth = this.agentState.getFinancialHealth();
      const startingNetWorth = this.agentState.getInitialCapital();
      const currentNetWorth = this.agentState.netWorth;
      const totalGrowth = currentNetWorth - startingNetWorth;
      const growthRate = (totalGrowth / startingNetWorth) * 100;
      
      // Campaign summary
      const allCampaigns = this.agentState.activeCampaigns;
      const periodCampaigns = allCampaigns.filter(
        c => c.createdDay >= startDay && c.createdDay <= endDay
      );
      
      // Product summary
      const allProducts = this.agentState.activeProducts;
      const periodProducts = allProducts.filter(
        p => p.createdDay >= startDay && p.createdDay <= endDay
      );
      
      // Key metrics
      const totalRevenue = allCampaigns.reduce((sum, c) => sum + c.revenue, 0);
      const totalSpend = allCampaigns.reduce((sum, c) => sum + c.spend, 0);
      const overallROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      
      // Decision summary would require memory access
      const periodDecisions: any[] = [];
      
      // Risk assessment
      const risks = this.assessBusinessRisks();
      
      // Opportunities
      const opportunities = this.identifyOpportunities();
      
      const report = {
        type,
        period: {
          startDay,
          endDay,
          totalDays: endDay - startDay + 1,
        },
        executive_summary: {
          netWorth: currentNetWorth,
          totalGrowth,
          growthRate: `${growthRate.toFixed(1)}%`,
          financialHealth: financialHealth.status,
          overallROAS,
        },
        financial_metrics: {
          revenue: {
            total: totalRevenue,
            daily_average: totalRevenue / currentDay,
          },
          spend: {
            total: totalSpend,
            daily_average: totalSpend / currentDay,
            daily_fee: this.agentState.dailyFee,
          },
          profit: {
            gross: totalRevenue - totalSpend,
            net: currentNetWorth - startingNetWorth,
          },
          roas: overallROAS,
          breakeven_roas: 1.5, // Standard breakeven ROAS
        },
        campaign_summary: {
          total_launched: periodCampaigns.length,
          currently_active: periodCampaigns.filter(c => c.status === 'active').length,
          killed: periodCampaigns.filter(c => c.status === 'killed').length,
          platform_distribution: this.calculatePlatformBreakdown(periodCampaigns),
          top_performers: this.getTopCampaigns(periodCampaigns, 3),
        },
        product_summary: {
          total_tested: periodProducts.length,
          currently_active: periodProducts.filter(p => p.status !== 'killed').length,
          winners: periodProducts.filter(p => p.status === 'scaling').length,
          average_margin: this.calculateAverageMargin(periodProducts),
        },
        decision_analysis: {
          total_decisions: periodDecisions.length,
          high_confidence: periodDecisions.filter((d: any) => d.confidence > 0.8).length,
          decision_types: this.categorizeDecisions(periodDecisions),
        },
        risk_assessment: risks,
        opportunities: opportunities,
        recommendations: this.generateRecommendations(financialHealth, overallROAS),
      };
      
      return {
        success: true,
        data: report,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to generate report: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Calculate product performance metrics
   */
  private calculateProductPerformance(campaigns: Campaign[]): any[] {
    const productMap = new Map<string, {
      revenue: number;
      spend: number;
      campaigns: number;
    }>();
    
    for (const campaign of campaigns) {
      const existing = productMap.get(campaign.productId) || {
        revenue: 0,
        spend: 0,
        campaigns: 0,
      };
      
      productMap.set(campaign.productId, {
        revenue: existing.revenue + campaign.revenue,
        spend: existing.spend + campaign.spend,
        campaigns: existing.campaigns + 1,
      });
    }
    
    return Array.from(productMap.entries()).map(([productId, metrics]) => ({
      productId,
      revenue: metrics.revenue,
      spend: metrics.spend,
      roas: metrics.spend > 0 ? metrics.revenue / metrics.spend : 0,
      campaigns: metrics.campaigns,
    }));
  }

  /**
   * Calculate platform breakdown
   */
  private calculatePlatformBreakdown(campaigns: Campaign[]): any {
    const platforms = ['facebook', 'tiktok', 'google'];
    const breakdown: any = {};
    
    for (const platform of platforms) {
      const platformCampaigns = campaigns.filter(c => c.platform === platform);
      const revenue = platformCampaigns.reduce((sum, c) => sum + c.revenue, 0);
      const spend = platformCampaigns.reduce((sum, c) => sum + c.spend, 0);
      
      breakdown[platform] = {
        campaigns: platformCampaigns.length,
        revenue,
        spend,
        roas: spend > 0 ? revenue / spend : 0,
      };
    }
    
    return breakdown;
  }

  /**
   * Get top performing campaigns
   */
  private getTopCampaigns(campaigns: Campaign[], limit: number): any[] {
    return campaigns
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map(campaign => ({
        id: campaign.id,
        platform: campaign.platform,
        angle: campaign.angle,
        revenue: campaign.revenue,
        spend: campaign.spend,
        roas: campaign.roas,
      }));
  }

  /**
   * Calculate average product margin
   */
  private calculateAverageMargin(products: Product[]): number {
    if (products.length === 0) return 0;
    const totalMargin = products.reduce((sum, p) => sum + p.margin, 0);
    return totalMargin / products.length;
  }

  /**
   * Categorize decisions by type
   */
  private categorizeDecisions(decisions: any[]): any {
    const categories: any = {
      product_research: 0,
      campaign_launch: 0,
      campaign_optimization: 0,
      financial: 0,
      strategic: 0,
    };
    
    for (const decision of decisions) {
      const decisionText = decision.decision.toLowerCase();
      
      if (decisionText.includes('product') || decisionText.includes('research')) {
        categories.product_research++;
      } else if (decisionText.includes('launch') || decisionText.includes('create')) {
        categories.campaign_launch++;
      } else if (decisionText.includes('scale') || decisionText.includes('kill') || decisionText.includes('optimize')) {
        categories.campaign_optimization++;
      } else if (decisionText.includes('budget') || decisionText.includes('financial')) {
        categories.financial++;
      } else {
        categories.strategic++;
      }
    }
    
    return categories;
  }

  /**
   * Assess business risks
   */
  private assessBusinessRisks(): any[] {
    const risks = [];
    const financialHealth = this.agentState.getFinancialHealth();
    
    if (financialHealth.status === 'critical' || financialHealth.status === 'bankrupt') {
      risks.push({
        type: 'financial',
        severity: 'critical',
        description: 'Imminent bankruptcy risk',
        mitigation: 'Kill all unprofitable campaigns immediately',
      });
    }
    
    if (this.agentState.currentROAS < 1.5) {
      risks.push({
        type: 'performance',
        severity: 'high',
        description: 'ROAS below breakeven threshold',
        mitigation: 'Focus on proven winners and pause experimentation',
      });
    }
    
    const activeCampaigns = this.agentState.activeCampaigns.filter(c => c.status === 'active');
    if (activeCampaigns.length === 0) {
      risks.push({
        type: 'operational',
        severity: 'high',
        description: 'No active campaigns running',
        mitigation: 'Launch campaigns for best performing products',
      });
    }
    
    return risks;
  }

  /**
   * Identify business opportunities
   */
  private identifyOpportunities(): any[] {
    const opportunities = [];
    
    // High ROAS campaigns to scale
    const scalableCampaigns = this.agentState.activeCampaigns
      .filter(c => c.status === 'active' && c.roas > 3.0);
    
    if (scalableCampaigns.length > 0) {
      opportunities.push({
        type: 'scaling',
        description: `${scalableCampaigns.length} campaigns with ROAS > 3.0x ready to scale`,
        potential: 'High revenue growth',
        action: 'Increase budgets by 50-100%',
      });
    }
    
    // Untested platforms
    const platformsUsed = new Set(this.agentState.activeCampaigns.map(c => c.platform));
    const untestedPlatforms = (['facebook', 'tiktok', 'google'] as const).filter(p => !platformsUsed.has(p));
    
    if (untestedPlatforms.length > 0) {
      opportunities.push({
        type: 'expansion',
        description: `Untested platforms: ${untestedPlatforms.join(', ')}`,
        potential: 'New customer acquisition channels',
        action: 'Test winning products on new platforms',
      });
    }
    
    return opportunities;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(financialHealth: any, overallROAS: number): string[] {
    const recommendations = [];
    
    if (financialHealth.status === 'critical') {
      recommendations.push('URGENT: Implement emergency measures - kill all campaigns with ROAS < 2.0');
    }
    
    if (overallROAS < 2.0) {
      recommendations.push('Focus on improving ROAS through better targeting and creative optimization');
    }
    
    if (this.agentState.activeProducts.length < 3) {
      recommendations.push('Increase product research efforts to build a larger testing pipeline');
    }
    
    const winningProducts = this.agentState.activeProducts.filter(p => p.status === 'scaling');
    if (winningProducts.length > 0) {
      recommendations.push('Scale winning products across multiple platforms and angles');
    }
    
    return recommendations;
  }
}