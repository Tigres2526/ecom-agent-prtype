import { z } from 'zod';
import type { AgentState as IAgentState, DailyMetrics } from '../types/index.js';
import { Product } from './Product.js';
import { Campaign } from './Campaign.js';

// Validation schema for AgentState
const AgentStateSchema = z.object({
  currentDay: z.number().min(0, 'Current day cannot be negative'),
  netWorth: z.number(),
  dailyFee: z.number().positive('Daily fee must be positive'),
  activeProducts: z.array(z.any()), // Will be validated separately
  activeCampaigns: z.array(z.any()), // Will be validated separately
  currentROAS: z.number().min(0, 'ROAS cannot be negative'),
  bankruptcyDays: z.number().min(0, 'Bankruptcy days cannot be negative'),
  errorCount: z.number().min(0, 'Error count cannot be negative'),
  totalRevenue: z.number().min(0, 'Total revenue cannot be negative'),
  totalSpend: z.number().min(0, 'Total spend cannot be negative'),
});

export class AgentState implements IAgentState {
  public currentDay: number;
  public netWorth: number;
  public dailyFee: number;
  public activeProducts: Product[];
  public activeCampaigns: Campaign[];
  public currentROAS: number;
  public bankruptcyDays: number;
  public errorCount: number;
  public totalRevenue: number;
  public totalSpend: number;

  private initialCapital: number;
  private bankruptcyThreshold: number;

  constructor(
    initialCapital: number,
    dailyFee: number,
    bankruptcyThreshold: number = 10
  ) {
    if (initialCapital <= 0) {
      throw new Error('Initial capital must be positive');
    }
    if (dailyFee <= 0) {
      throw new Error('Daily fee must be positive');
    }
    if (bankruptcyThreshold <= 0) {
      throw new Error('Bankruptcy threshold must be positive');
    }

    this.currentDay = 0;
    this.netWorth = initialCapital;
    this.dailyFee = dailyFee;
    this.activeProducts = [];
    this.activeCampaigns = [];
    this.currentROAS = 0;
    this.bankruptcyDays = 0;
    this.errorCount = 0;
    this.totalRevenue = 0;
    this.totalSpend = 0;

    this.initialCapital = initialCapital;
    this.bankruptcyThreshold = bankruptcyThreshold;
  }

  /**
   * Advances to the next day and deducts daily fees
   */
  public advanceDay(): void {
    this.currentDay++;
    this.netWorth -= this.dailyFee;
    this.totalSpend += this.dailyFee;

    // Update bankruptcy tracking
    if (this.netWorth < 0) {
      this.bankruptcyDays++;
    } else {
      this.bankruptcyDays = 0;
    }

    // Recalculate current ROAS
    this.updateROAS();
  }

  /**
   * Updates financial metrics from campaign performance
   */
  public updateFinancials(revenue: number, adSpend: number): void {
    if (revenue < 0 || adSpend < 0) {
      throw new Error('Revenue and ad spend must be non-negative');
    }

    this.totalRevenue += revenue;
    this.totalSpend += adSpend;
    this.netWorth += revenue - adSpend;

    // Reset bankruptcy counter if we're back in the positive
    if (this.netWorth >= 0) {
      this.bankruptcyDays = 0;
    }

    this.updateROAS();
  }

  /**
   * Recalculates current ROAS based on total metrics
   */
  private updateROAS(): void {
    this.currentROAS = this.totalSpend > 0 ? this.totalRevenue / this.totalSpend : 0;
  }

  /**
   * Checks if agent is bankrupt
   */
  public isBankrupt(): boolean {
    return this.bankruptcyDays >= this.bankruptcyThreshold;
  }

  /**
   * Checks if agent can afford a given expense
   */
  public canAfford(amount: number): boolean {
    return this.netWorth >= amount;
  }

  /**
   * Gets available budget for new campaigns
   */
  public getAvailableBudget(): number {
    // Reserve enough for daily fees for next 7 days
    const reservedAmount = this.dailyFee * 7;
    return Math.max(0, this.netWorth - reservedAmount);
  }

  /**
   * Adds a product to active products
   */
  public addProduct(product: Product): void {
    if (this.activeProducts.find(p => p.id === product.id)) {
      throw new Error('Product already exists in active products');
    }
    this.activeProducts.push(product);
  }

  /**
   * Removes a product from active products
   */
  public removeProduct(productId: string): void {
    const index = this.activeProducts.findIndex(p => p.id === productId);
    if (index === -1) {
      throw new Error('Product not found in active products');
    }
    this.activeProducts.splice(index, 1);
  }

  /**
   * Adds a campaign to active campaigns
   */
  public addCampaign(campaign: Campaign): void {
    if (this.activeCampaigns.find(c => c.id === campaign.id)) {
      throw new Error('Campaign already exists in active campaigns');
    }
    this.activeCampaigns.push(campaign);
  }

  /**
   * Removes a campaign from active campaigns
   */
  public removeCampaign(campaignId: string): void {
    const index = this.activeCampaigns.findIndex(c => c.id === campaignId);
    if (index === -1) {
      throw new Error('Campaign not found in active campaigns');
    }
    this.activeCampaigns.splice(index, 1);
  }

  /**
   * Gets campaign by ID
   */
  public getCampaign(campaignId: string): Campaign | undefined {
    return this.activeCampaigns.find(c => c.id === campaignId);
  }

  /**
   * Gets product by ID
   */
  public getProduct(productId: string): Product | undefined {
    return this.activeProducts.find(p => p.id === productId);
  }

  /**
   * Gets campaigns for a specific product
   */
  public getCampaignsForProduct(productId: string): Campaign[] {
    return this.activeCampaigns.filter(c => c.productId === productId);
  }

  /**
   * Increments error count
   */
  public incrementErrorCount(): void {
    this.errorCount++;
  }

  /**
   * Resets error count
   */
  public resetErrorCount(): void {
    this.errorCount = 0;
  }

  /**
   * Checks if error count exceeds threshold
   */
  public hasExcessiveErrors(threshold: number = 10): boolean {
    return this.errorCount >= threshold;
  }

  /**
   * Gets financial health status
   */
  public getFinancialHealth(): {
    status: 'excellent' | 'good' | 'warning' | 'critical' | 'bankrupt';
    daysUntilBankruptcy: number | null;
    recommendation: string;
  } {
    if (this.isBankrupt()) {
      return {
        status: 'bankrupt',
        daysUntilBankruptcy: 0,
        recommendation: 'Agent is bankrupt - simulation should end',
      };
    }

    const daysUntilBankruptcy = this.netWorth > 0 
      ? Math.floor(this.netWorth / this.dailyFee)
      : this.bankruptcyThreshold - this.bankruptcyDays;

    let status: 'excellent' | 'good' | 'warning' | 'critical';
    let recommendation: string;

    if (this.netWorth >= this.initialCapital * 2) {
      status = 'excellent';
      recommendation = 'Scale aggressively';
    } else if (this.netWorth >= this.initialCapital) {
      status = 'good';
      recommendation = 'Continue current strategy';
    } else if (this.netWorth >= this.initialCapital * 0.5) {
      status = 'warning';
      recommendation = 'Optimize campaigns and reduce risk';
    } else {
      status = 'critical';
      recommendation = 'Enter conservative mode immediately';
    }

    return {
      status,
      daysUntilBankruptcy,
      recommendation,
    };
  }

  /**
   * Gets performance metrics for the current day
   */
  public getDailyMetrics(): DailyMetrics {
    return {
      day: this.currentDay,
      netWorth: this.netWorth,
      revenue: this.totalRevenue,
      spend: this.totalSpend,
      roas: this.currentROAS,
      activeProducts: this.activeProducts.length,
      activeCampaigns: this.activeCampaigns.length,
      newProducts: 0, // This would be tracked separately
      killedCampaigns: 0, // This would be tracked separately
      scaledCampaigns: 0, // This would be tracked separately
      errors: this.errorCount,
    };
  }

  /**
   * Gets initial capital
   */
  public getInitialCapital(): number {
    return this.initialCapital;
  }

  /**
   * Gets summary statistics
   */
  public getSummary(): {
    totalProfit: number;
    profitMargin: number;
    averageROAS: number;
    daysActive: number;
    productsLaunched: number;
    campaignsLaunched: number;
  } {
    const totalProfit = this.totalRevenue - this.totalSpend;
    const profitMargin = this.totalRevenue > 0 ? (totalProfit / this.totalRevenue) * 100 : 0;

    return {
      totalProfit,
      profitMargin,
      averageROAS: this.currentROAS,
      daysActive: this.currentDay,
      productsLaunched: this.activeProducts.length,
      campaignsLaunched: this.activeCampaigns.length,
    };
  }

  /**
   * Serializes agent state to JSON
   */
  public toJSON(): IAgentState {
    return {
      currentDay: this.currentDay,
      netWorth: this.netWorth,
      dailyFee: this.dailyFee,
      activeProducts: this.activeProducts,
      activeCampaigns: this.activeCampaigns,
      currentROAS: this.currentROAS,
      bankruptcyDays: this.bankruptcyDays,
      errorCount: this.errorCount,
      totalRevenue: this.totalRevenue,
      totalSpend: this.totalSpend,
    };
  }

  /**
   * Creates AgentState instance from JSON data
   */
  public static fromJSON(
    data: IAgentState,
    initialCapital: number,
    bankruptcyThreshold: number = 10
  ): AgentState {
    const state = new AgentState(initialCapital, data.dailyFee, bankruptcyThreshold);
    
    state.currentDay = data.currentDay;
    state.netWorth = data.netWorth;
    state.activeProducts = data.activeProducts.map(p => Product.fromJSON(p));
    state.activeCampaigns = data.activeCampaigns.map(c => Campaign.fromJSON(c));
    state.currentROAS = data.currentROAS;
    state.bankruptcyDays = data.bankruptcyDays;
    state.errorCount = data.errorCount;
    state.totalRevenue = data.totalRevenue;
    state.totalSpend = data.totalSpend;

    return state;
  }

  /**
   * Validates agent state data without creating instance
   */
  public static validate(data: unknown): data is IAgentState {
    try {
      AgentStateSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }
}