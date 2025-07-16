import type { 
  DailyMetrics,
  ToolResult 
} from '../types/index.js';
import { AgentState } from '../models/AgentState.js';
import { Campaign } from '../models/Campaign.js';
import { Product } from '../models/Product.js';

/**
 * Financial tracking and bankruptcy protection system
 */
export class FinancialTracker {
  private dailyMetricsHistory: DailyMetrics[];
  private financialAlerts: Array<{
    type: 'warning' | 'critical' | 'bankruptcy';
    message: string;
    timestamp: Date;
    day: number;
    resolved: boolean;
  }>;
  private bankruptcyProtectionEnabled: boolean;
  private minROASThreshold: number;
  private maxDailySpendLimit: number;
  private emergencyReserve: number;

  constructor(
    minROASThreshold: number = 1.5,
    maxDailySpendLimit: number = 1000,
    emergencyReserve: number = 100
  ) {
    this.dailyMetricsHistory = [];
    this.financialAlerts = [];
    this.bankruptcyProtectionEnabled = true;
    this.minROASThreshold = minROASThreshold;
    this.maxDailySpendLimit = maxDailySpendLimit;
    this.emergencyReserve = emergencyReserve;
  }

  /**
   * Updates daily financial metrics and checks for alerts
   */
  public updateDailyMetrics(agentState: AgentState): DailyMetrics {
    const metrics = agentState.getDailyMetrics();
    
    // Add calculated fields
    const enhancedMetrics = {
      ...metrics,
      profitMargin: metrics.revenue > 0 ? ((metrics.revenue - metrics.spend) / metrics.revenue) * 100 : 0,
      burnRate: this.calculateBurnRate(agentState),
      daysUntilBankruptcy: this.calculateDaysUntilBankruptcy(agentState),
      financialHealth: agentState.getFinancialHealth().status,
      availableBudget: agentState.getAvailableBudget(),
      totalProfit: metrics.revenue - metrics.spend
    };
    
    this.dailyMetricsHistory.push(enhancedMetrics);
    
    // Check for financial alerts
    this.checkFinancialAlerts(agentState, enhancedMetrics);
    
    // Enforce bankruptcy protection
    if (this.bankruptcyProtectionEnabled) {
      this.enforceBankruptcyProtection(agentState);
    }
    
    return enhancedMetrics;
  }

  /**
   * Calculates current burn rate (daily cash consumption)
   */
  private calculateBurnRate(agentState: AgentState): number {
    if (this.dailyMetricsHistory.length < 2) {
      return agentState.dailyFee; // Default to daily fee
    }
    
    const recent = this.dailyMetricsHistory.slice(-7); // Last 7 days
    const totalSpendIncrease = recent.reduce((sum, day, index) => {
      if (index === 0) return sum;
      return sum + (day.spend - recent[index - 1].spend);
    }, 0);
    
    return totalSpendIncrease / Math.max(1, recent.length - 1);
  }

  /**
   * Calculates days until bankruptcy at current burn rate
   */
  private calculateDaysUntilBankruptcy(agentState: AgentState): number | null {
    if (agentState.netWorth <= 0) {
      return 0;
    }
    
    const burnRate = this.calculateBurnRate(agentState);
    if (burnRate <= 0) {
      return null; // Profitable, no bankruptcy risk
    }
    
    return Math.floor((agentState.netWorth - this.emergencyReserve) / burnRate);
  }

  /**
   * Checks for financial alerts and warnings
   */
  private checkFinancialAlerts(agentState: AgentState, metrics: any): void {
    const currentDay = agentState.currentDay;
    
    // Bankruptcy alert
    if (agentState.isBankrupt()) {
      this.addAlert('bankruptcy', 'Agent has declared bankruptcy', currentDay);
      return;
    }
    
    // Critical financial health
    if (metrics.financialHealth === 'critical') {
      this.addAlert('critical', 'Critical financial situation - immediate action required', currentDay);
    }
    
    // Low ROAS warning
    if (metrics.roas < this.minROASThreshold && metrics.spend > 100) {
      this.addAlert('warning', `ROAS below threshold: ${metrics.roas.toFixed(2)} < ${this.minROASThreshold}`, currentDay);
    }
    
    // High burn rate warning
    if (metrics.daysUntilBankruptcy !== null && metrics.daysUntilBankruptcy < 7) {
      this.addAlert('critical', `Only ${metrics.daysUntilBankruptcy} days until bankruptcy at current burn rate`, currentDay);
    }
    
    // Daily spend limit exceeded
    const dailySpend = this.calculateDailySpend(agentState);
    if (dailySpend > this.maxDailySpendLimit) {
      this.addAlert('warning', `Daily spend limit exceeded: $${dailySpend} > $${this.maxDailySpendLimit}`, currentDay);
    }
    
    // Negative cash flow trend
    if (this.detectNegativeTrend()) {
      this.addAlert('warning', 'Negative cash flow trend detected over last 3 days', currentDay);
    }
    
    // Low available budget
    if (metrics.availableBudget < this.emergencyReserve) {
      this.addAlert('critical', `Available budget below emergency reserve: $${metrics.availableBudget} < $${this.emergencyReserve}`, currentDay);
    }
  }

  /**
   * Adds a financial alert
   */
  private addAlert(
    type: 'warning' | 'critical' | 'bankruptcy',
    message: string,
    day: number
  ): void {
    // Check if similar alert already exists and is unresolved
    const existingAlert = this.financialAlerts.find(
      alert => alert.message === message && !alert.resolved
    );
    
    if (!existingAlert) {
      this.financialAlerts.push({
        type,
        message,
        timestamp: new Date(),
        day,
        resolved: false
      });
      
      console.warn(`🚨 Financial Alert [${type.toUpperCase()}]: ${message}`);
    }
  }

  /**
   * Calculates current daily spend
   */
  private calculateDailySpend(agentState: AgentState): number {
    if (this.dailyMetricsHistory.length < 2) {
      return agentState.dailyFee;
    }
    
    const today = this.dailyMetricsHistory[this.dailyMetricsHistory.length - 1];
    const yesterday = this.dailyMetricsHistory[this.dailyMetricsHistory.length - 2];
    
    return today.spend - yesterday.spend;
  }

  /**
   * Detects negative cash flow trend
   */
  private detectNegativeTrend(): boolean {
    if (this.dailyMetricsHistory.length < 4) {
      return false;
    }
    
    const recent = this.dailyMetricsHistory.slice(-3);
    let negativeDays = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const dailyProfit = (recent[i].revenue - recent[i - 1].revenue) - 
                         (recent[i].spend - recent[i - 1].spend);
      if (dailyProfit < 0) {
        negativeDays++;
      }
    }
    
    return negativeDays >= 2; // 2 out of 3 days negative
  }

  /**
   * Enforces bankruptcy protection measures
   */
  private enforceBankruptcyProtection(agentState: AgentState): void {
    const financialHealth = agentState.getFinancialHealth();
    
    // Emergency measures for critical financial health
    if (financialHealth.status === 'critical') {
      this.implementEmergencyMeasures(agentState);
    }
    
    // Prevent overspending
    this.enforceSpendingLimits(agentState);
    
    // Kill losing campaigns automatically
    this.killLosingCampaigns(agentState);
    
    // Reduce budgets if burn rate is too high
    if (this.calculateDaysUntilBankruptcy(agentState) !== null && 
        this.calculateDaysUntilBankruptcy(agentState)! < 5) {
      this.reduceCampaignBudgets(agentState, 0.5); // 50% reduction
    }
  }

  /**
   * Implements emergency financial measures
   */
  private implementEmergencyMeasures(agentState: AgentState): void {
    console.warn('🚨 IMPLEMENTING EMERGENCY FINANCIAL MEASURES');
    
    // Kill all campaigns with ROAS < 1.0
    const campaignsToKill = agentState.activeCampaigns.filter(
      campaign => campaign.roas < 1.0 && campaign.spend > 25
    );
    
    campaignsToKill.forEach(campaign => {
      campaign.status = 'killed';
      console.warn(`Emergency killed campaign ${campaign.id} - ROAS: ${campaign.roas}`);
    });
    
    // Pause all product research
    agentState.activeProducts.forEach(product => {
      if (product.status === 'researching') {
        product.status = 'killed';
        console.warn(`Emergency paused product research: ${product.name}`);
      }
    });
    
    // Reduce all active campaign budgets by 70%
    this.reduceCampaignBudgets(agentState, 0.3);
  }

  /**
   * Enforces spending limits
   */
  private enforceSpendingLimits(agentState: AgentState): void {
    const availableBudget = agentState.getAvailableBudget();
    const totalActiveBudgets = agentState.activeCampaigns
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + c.budget, 0);
    
    if (totalActiveBudgets > availableBudget) {
      const reductionFactor = availableBudget / totalActiveBudgets;
      this.reduceCampaignBudgets(agentState, reductionFactor);
      
      console.warn(`Reduced campaign budgets by ${((1 - reductionFactor) * 100).toFixed(1)}% to stay within available budget`);
    }
  }

  /**
   * Automatically kills losing campaigns
   */
  public killLosingCampaigns(agentState: AgentState): number;
  public killLosingCampaigns(campaigns: Campaign[], minROAS: number): number;
  public killLosingCampaigns(agentStateOrCampaigns: AgentState | Campaign[], minROAS?: number): number {
    let campaignsToCheck: Campaign[];
    let roasThreshold: number;
    
    if ('activeCampaigns' in agentStateOrCampaigns) {
      // Called with AgentState
      campaignsToCheck = agentStateOrCampaigns.activeCampaigns;
      roasThreshold = 0.8; // Default for AgentState
    } else {
      // Called with Campaign[]
      campaignsToCheck = agentStateOrCampaigns;
      roasThreshold = minROAS || 1.0;
    }
    
    const campaignsToKill = campaignsToCheck.filter(campaign => 
      campaign.status === 'active' &&
      campaign.spend >= 50 && // Minimum spend threshold
      campaign.roas < roasThreshold
    );
    
    campaignsToKill.forEach(campaign => {
      campaign.status = 'killed';
      console.warn(`Auto-killed losing campaign ${campaign.id} - ROAS: ${campaign.roas}, Spend: $${campaign.spend}`);
    });
    
    return campaignsToKill.length;
  }

  /**
   * Reduces campaign budgets by specified factor
   */
  private reduceCampaignBudgets(agentState: AgentState, factor: number): void {
    agentState.activeCampaigns.forEach(campaign => {
      if (campaign.status === 'active') {
        const oldBudget = campaign.budget;
        campaign.budget = Math.max(10, campaign.budget * factor); // Minimum $10 budget
        
        if (campaign.budget !== oldBudget) {
          console.warn(`Reduced campaign ${campaign.id} budget from $${oldBudget} to $${campaign.budget}`);
        }
      }
    });
  }

  /**
   * Analyzes ROAS performance and provides recommendations
   */
  public analyzeROASPerformance(agentState: AgentState): {
    currentROAS: number;
    targetROAS: number;
    performance: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
    recommendations: string[];
    campaignAnalysis: Array<{
      campaignId: string;
      platform: string;
      roas: number;
      recommendation: string;
    }>;
  } {
    const currentROAS = agentState.currentROAS;
    
    let performance: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
    if (currentROAS >= 3.0) performance = 'excellent';
    else if (currentROAS >= 2.0) performance = 'good';
    else if (currentROAS >= this.minROASThreshold) performance = 'acceptable';
    else if (currentROAS >= 1.0) performance = 'poor';
    else performance = 'critical';
    
    const recommendations: string[] = [];
    
    if (performance === 'critical') {
      recommendations.push('URGENT: Kill all campaigns with ROAS < 1.0 immediately');
      recommendations.push('Pause all new spending until ROAS improves');
      recommendations.push('Review and optimize existing campaigns');
    } else if (performance === 'poor') {
      recommendations.push('Kill campaigns with ROAS < 0.8');
      recommendations.push('Optimize underperforming campaigns');
      recommendations.push('Test new angles for existing products');
    } else if (performance === 'acceptable') {
      recommendations.push('Scale campaigns with ROAS > 2.0');
      recommendations.push('Optimize campaigns with ROAS 1.5-2.0');
      recommendations.push('Consider testing new products');
    } else if (performance === 'good') {
      recommendations.push('Aggressively scale top performers');
      recommendations.push('Launch new product tests');
      recommendations.push('Expand to new platforms');
    } else {
      recommendations.push('Scale all profitable campaigns');
      recommendations.push('Launch multiple new products');
      recommendations.push('Consider increasing daily budgets');
    }
    
    const campaignAnalysis = agentState.activeCampaigns.map(campaign => ({
      campaignId: campaign.id,
      platform: campaign.platform,
      roas: campaign.roas,
      recommendation: this.getCampaignRecommendation(campaign)
    }));
    
    return {
      currentROAS,
      targetROAS: this.minROASThreshold,
      performance,
      recommendations,
      campaignAnalysis
    };
  }

  /**
   * Gets recommendation for individual campaign
   */
  private getCampaignRecommendation(campaign: Campaign): string {
    if (campaign.roas >= 3.0) {
      return 'Scale aggressively - excellent performance';
    } else if (campaign.roas >= 2.0) {
      return 'Scale moderately - good performance';
    } else if (campaign.roas >= this.minROASThreshold) {
      return 'Optimize before scaling';
    } else if (campaign.roas >= 1.0) {
      return 'Optimize or consider killing';
    } else {
      return 'Kill immediately - losing money';
    }
  }

  /**
   * Calculates financial projections
   */
  public calculateProjections(
    agentState: AgentState,
    days: number = 30
  ): {
    projectedNetWorth: number;
    projectedRevenue: number;
    projectedSpend: number;
    projectedROAS: number;
    bankruptcyRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
    assumptions: string[];
  } {
    const currentMetrics = this.dailyMetricsHistory.slice(-7); // Last 7 days
    if (currentMetrics.length === 0) {
      return {
        projectedNetWorth: agentState.netWorth,
        projectedRevenue: 0,
        projectedSpend: 0,
        projectedROAS: 0,
        bankruptcyRisk: 'none',
        assumptions: ['No historical data available']
      };
    }
    
    // Calculate trends
    const avgDailyRevenue = this.calculateAverage(currentMetrics.map(m => m.revenue));
    const avgDailySpend = this.calculateAverage(currentMetrics.map(m => m.spend));
    const avgROAS = avgDailySpend > 0 ? avgDailyRevenue / avgDailySpend : 0;
    
    // Project forward
    const projectedRevenue = avgDailyRevenue * days;
    const projectedSpend = avgDailySpend * days;
    const projectedNetWorth = agentState.netWorth + (projectedRevenue - projectedSpend);
    
    // Assess bankruptcy risk
    let bankruptcyRisk: 'none' | 'low' | 'medium' | 'high' | 'critical';
    if (projectedNetWorth < -500) bankruptcyRisk = 'critical';
    else if (projectedNetWorth < 0) bankruptcyRisk = 'high';
    else if (projectedNetWorth < 200) bankruptcyRisk = 'medium';
    else if (projectedNetWorth < 500) bankruptcyRisk = 'low';
    else bankruptcyRisk = 'none';
    
    const assumptions = [
      `Based on last ${currentMetrics.length} days of data`,
      `Average daily revenue: $${avgDailyRevenue.toFixed(2)}`,
      `Average daily spend: $${avgDailySpend.toFixed(2)}`,
      'Assumes current performance trends continue'
    ];
    
    return {
      projectedNetWorth,
      projectedRevenue,
      projectedSpend,
      projectedROAS: avgROAS,
      bankruptcyRisk,
      assumptions
    };
  }

  /**
   * Calculates average of array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Gets comprehensive financial report
   */
  public getFinancialReport(agentState: AgentState): {
    currentStatus: ReturnType<AgentState['getFinancialHealth']>;
    dailyMetrics: DailyMetrics;
    roasAnalysis: ReturnType<FinancialTracker['analyzeROASPerformance']>;
    projections: ReturnType<FinancialTracker['calculateProjections']>;
    alerts: Array<{
      type: 'warning' | 'critical' | 'bankruptcy';
      message: string;
      timestamp: Date;
      day: number;
      resolved: boolean;
    }>;
    trends: {
      revenueGrowth: number;
      spendGrowth: number;
      roasTrend: 'improving' | 'stable' | 'declining';
      profitabilityTrend: 'improving' | 'stable' | 'declining';
    };
    recommendations: string[];
  } {
    const currentStatus = agentState.getFinancialHealth();
    const dailyMetrics = this.updateDailyMetrics(agentState);
    const roasAnalysis = this.analyzeROASPerformance(agentState);
    const projections = this.calculateProjections(agentState);
    const trends = this.calculateTrends();
    
    const recommendations = [
      ...roasAnalysis.recommendations,
      ...this.generateFinancialRecommendations(agentState, projections)
    ];
    
    return {
      currentStatus,
      dailyMetrics,
      roasAnalysis,
      projections,
      alerts: this.financialAlerts.filter(a => !a.resolved),
      trends,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    };
  }

  /**
   * Calculates financial trends
   */
  private calculateTrends(): {
    revenueGrowth: number;
    spendGrowth: number;
    roasTrend: 'improving' | 'stable' | 'declining';
    profitabilityTrend: 'improving' | 'stable' | 'declining';
  } {
    if (this.dailyMetricsHistory.length < 7) {
      return {
        revenueGrowth: 0,
        spendGrowth: 0,
        roasTrend: 'stable',
        profitabilityTrend: 'stable'
      };
    }
    
    const recent = this.dailyMetricsHistory.slice(-7);
    const older = this.dailyMetricsHistory.slice(-14, -7);
    
    const recentAvgRevenue = this.calculateAverage(recent.map(m => m.revenue));
    const olderAvgRevenue = this.calculateAverage(older.map(m => m.revenue));
    const revenueGrowth = olderAvgRevenue > 0 ? 
      ((recentAvgRevenue - olderAvgRevenue) / olderAvgRevenue) * 100 : 0;
    
    const recentAvgSpend = this.calculateAverage(recent.map(m => m.spend));
    const olderAvgSpend = this.calculateAverage(older.map(m => m.spend));
    const spendGrowth = olderAvgSpend > 0 ? 
      ((recentAvgSpend - olderAvgSpend) / olderAvgSpend) * 100 : 0;
    
    const recentAvgROAS = this.calculateAverage(recent.map(m => m.roas));
    const olderAvgROAS = this.calculateAverage(older.map(m => m.roas));
    
    let roasTrend: 'improving' | 'stable' | 'declining';
    if (recentAvgROAS > olderAvgROAS * 1.1) roasTrend = 'improving';
    else if (recentAvgROAS < olderAvgROAS * 0.9) roasTrend = 'declining';
    else roasTrend = 'stable';
    
    const recentProfitMargin = this.calculateAverage(recent.map(m => (m as any).profitMargin || 0));
    const olderProfitMargin = this.calculateAverage(older.map(m => (m as any).profitMargin || 0));
    
    let profitabilityTrend: 'improving' | 'stable' | 'declining';
    if (recentProfitMargin > olderProfitMargin + 5) profitabilityTrend = 'improving';
    else if (recentProfitMargin < olderProfitMargin - 5) profitabilityTrend = 'declining';
    else profitabilityTrend = 'stable';
    
    return {
      revenueGrowth,
      spendGrowth,
      roasTrend,
      profitabilityTrend
    };
  }

  /**
   * Generates financial recommendations
   */
  private generateFinancialRecommendations(
    agentState: AgentState,
    projections: ReturnType<FinancialTracker['calculateProjections']>
  ): string[] {
    const recommendations: string[] = [];
    
    if (projections.bankruptcyRisk === 'critical' || projections.bankruptcyRisk === 'high') {
      recommendations.push('URGENT: Implement emergency cost reduction measures');
      recommendations.push('Kill all unprofitable campaigns immediately');
      recommendations.push('Pause all new product launches');
    }
    
    if (agentState.getAvailableBudget() < this.emergencyReserve) {
      recommendations.push('Increase emergency reserve or reduce spending');
    }
    
    const burnRate = this.calculateBurnRate(agentState);
    if (burnRate > agentState.dailyFee * 3) {
      recommendations.push('Daily burn rate is too high - reduce campaign budgets');
    }
    
    const trends = this.calculateTrends();
    if (trends.roasTrend === 'declining') {
      recommendations.push('ROAS is declining - review and optimize campaigns');
    }
    
    if (trends.profitabilityTrend === 'declining') {
      recommendations.push('Profitability declining - focus on margin improvement');
    }
    
    return recommendations;
  }

  /**
   * Resolves a financial alert
   */
  public resolveAlert(alertIndex: number): boolean {
    if (alertIndex >= 0 && alertIndex < this.financialAlerts.length) {
      this.financialAlerts[alertIndex].resolved = true;
      return true;
    }
    return false;
  }

  /**
   * Gets unresolved alerts
   */
  public getUnresolvedAlerts(): typeof this.financialAlerts {
    return this.financialAlerts.filter(alert => !alert.resolved);
  }

  /**
   * Clears resolved alerts older than specified days
   */
  public clearOldAlerts(days: number = 7): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const initialLength = this.financialAlerts.length;
    this.financialAlerts = this.financialAlerts.filter(
      alert => !alert.resolved || alert.timestamp > cutoff
    );
    
    return initialLength - this.financialAlerts.length;
  }

  /**
   * Enables or disables bankruptcy protection
   */
  public setBankruptcyProtection(enabled: boolean): void {
    this.bankruptcyProtectionEnabled = enabled;
    console.log(`Bankruptcy protection ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Updates financial thresholds
   */
  public updateThresholds(
    minROAS?: number,
    maxDailySpend?: number,
    emergencyReserve?: number
  ): void {
    if (minROAS !== undefined) this.minROASThreshold = minROAS;
    if (maxDailySpend !== undefined) this.maxDailySpendLimit = maxDailySpend;
    if (emergencyReserve !== undefined) this.emergencyReserve = emergencyReserve;
    
    console.log('Financial thresholds updated:', {
      minROAS: this.minROASThreshold,
      maxDailySpend: this.maxDailySpendLimit,
      emergencyReserve: this.emergencyReserve
    });
  }

  /**
   * Gets financial tracker configuration
   */
  public getConfiguration(): {
    minROASThreshold: number;
    maxDailySpendLimit: number;
    emergencyReserve: number;
    bankruptcyProtectionEnabled: boolean;
  } {
    return {
      minROASThreshold: this.minROASThreshold,
      maxDailySpendLimit: this.maxDailySpendLimit,
      emergencyReserve: this.emergencyReserve,
      bankruptcyProtectionEnabled: this.bankruptcyProtectionEnabled
    };
  }

  /**
   * Exports financial data for analysis
   */
  public exportFinancialData(): {
    dailyMetrics: DailyMetrics[];
    alerts: Array<{
      type: 'warning' | 'critical' | 'bankruptcy';
      message: string;
      timestamp: Date;
      day: number;
      resolved: boolean;
    }>;
    configuration: ReturnType<FinancialTracker['getConfiguration']>;
    exportedAt: Date;
  } {
    return {
      dailyMetrics: [...this.dailyMetricsHistory],
      alerts: [...this.financialAlerts],
      configuration: this.getConfiguration(),
      exportedAt: new Date()
    };
  }
}