import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { Campaign as ICampaign } from '../types/index.js';

// Validation schema for Campaign
const CampaignSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid('Invalid product ID'),
  platform: z.enum(['facebook', 'tiktok', 'google']),
  angle: z.string().min(1, 'Marketing angle is required'),
  budget: z.number().positive('Budget must be positive'),
  spend: z.number().min(0, 'Spend cannot be negative'),
  revenue: z.number().min(0, 'Revenue cannot be negative'),
  roas: z.number().min(0, 'ROAS cannot be negative'),
  status: z.enum(['active', 'paused', 'killed']),
  createdDay: z.number().min(0, 'Created day cannot be negative'),
  lastOptimized: z.number().min(0, 'Last optimized day cannot be negative'),
  impressions: z.number().min(0).optional(),
  clicks: z.number().min(0).optional(),
  conversions: z.number().min(0).optional(),
  ctr: z.number().min(0).max(100).optional(),
  cpc: z.number().min(0).optional(),
});

export class Campaign implements ICampaign {
  public readonly id: string;
  public readonly productId: string;
  public readonly platform: 'facebook' | 'tiktok' | 'google';
  public angle: string;
  public budget: number;
  public spend: number;
  public revenue: number;
  public roas: number;
  public status: 'active' | 'paused' | 'killed';
  public readonly createdDay: number;
  public lastOptimized: number;
  public impressions?: number;
  public clicks?: number;
  public conversions?: number;
  public ctr?: number;
  public cpc?: number;

  constructor(data: Omit<ICampaign, 'id'> & { id?: string }) {
    const validated = CampaignSchema.parse({
      id: data.id || uuidv4(),
      ...data,
    });

    this.id = validated.id;
    this.productId = validated.productId;
    this.platform = validated.platform;
    this.angle = validated.angle;
    this.budget = validated.budget;
    this.spend = validated.spend;
    this.revenue = validated.revenue;
    this.roas = validated.roas;
    this.status = validated.status;
    this.createdDay = validated.createdDay;
    this.lastOptimized = validated.lastOptimized;
    this.impressions = validated.impressions;
    this.clicks = validated.clicks;
    this.conversions = validated.conversions;
    this.ctr = validated.ctr;
    this.cpc = validated.cpc;

    // Validate ROAS calculation
    this.validateROAS();
  }

  /**
   * Validates ROAS calculation consistency
   */
  private validateROAS(): void {
    if (this.spend > 0) {
      const calculatedROAS = this.revenue / this.spend;
      const roasDifference = Math.abs(this.roas - calculatedROAS);
      
      if (roasDifference > 0.01) { // Allow for small floating point differences
        throw new Error(
          `ROAS inconsistency: Expected ${calculatedROAS.toFixed(2)}, got ${this.roas.toFixed(2)}`
        );
      }
    } else if (this.roas !== 0) {
      throw new Error('ROAS should be 0 when spend is 0');
    }
  }

  /**
   * Updates campaign metrics and recalculates ROAS
   */
  public updateMetrics(spend: number, revenue: number, day: number): void {
    if (spend < 0 || revenue < 0) {
      throw new Error('Spend and revenue must be non-negative');
    }

    this.spend = spend;
    this.revenue = revenue;
    this.roas = spend > 0 ? revenue / spend : 0;
    this.lastOptimized = day;

    // Update derived metrics if available
    if (this.impressions && this.clicks) {
      this.ctr = (this.clicks / this.impressions) * 100;
    }
    
    if (this.clicks && this.spend > 0) {
      this.cpc = this.spend / this.clicks;
    }
  }

  /**
   * Updates detailed performance metrics
   */
  public updateDetailedMetrics(metrics: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
  }): void {
    if (metrics.impressions !== undefined) {
      if (metrics.impressions < 0) {
        throw new Error('Impressions cannot be negative');
      }
      this.impressions = metrics.impressions;
    }

    if (metrics.clicks !== undefined) {
      if (metrics.clicks < 0) {
        throw new Error('Clicks cannot be negative');
      }
      this.clicks = metrics.clicks;
    }

    if (metrics.conversions !== undefined) {
      if (metrics.conversions < 0) {
        throw new Error('Conversions cannot be negative');
      }
      this.conversions = metrics.conversions;
    }

    // Recalculate derived metrics
    if (this.impressions && this.clicks) {
      this.ctr = (this.clicks / this.impressions) * 100;
    }

    if (this.clicks && this.spend > 0) {
      this.cpc = this.spend / this.clicks;
    }
  }

  /**
   * Checks if campaign meets breakeven ROAS threshold
   */
  public meetsBreakevenROAS(threshold: number = 1.5): boolean {
    return this.roas >= threshold;
  }

  /**
   * Checks if campaign is profitable
   */
  public isProfitable(): boolean {
    return this.roas > 1.0;
  }

  /**
   * Checks if campaign is ready for scaling
   */
  public isReadyForScaling(minROAS: number = 2.0, minSpend: number = 100): boolean {
    return (
      this.status === 'active' &&
      this.roas >= minROAS &&
      this.spend >= minSpend
    );
  }

  /**
   * Checks if campaign should be killed
   */
  public shouldBeKilled(minROAS: number = 1.0, minSpend: number = 50): boolean {
    return (
      this.status === 'active' &&
      this.spend >= minSpend &&
      this.roas < minROAS
    );
  }

  /**
   * Updates campaign status with validation
   */
  public updateStatus(newStatus: ICampaign['status']): void {
    const validTransitions: Record<ICampaign['status'], ICampaign['status'][]> = {
      active: ['paused', 'killed'],
      paused: ['active', 'killed'],
      killed: [], // No transitions from killed
    };

    const allowedTransitions = validTransitions[this.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${this.status} to ${newStatus}`
      );
    }

    this.status = newStatus;
  }

  /**
   * Scales campaign budget
   */
  public scaleBudget(newBudget: number, reason: string): void {
    if (newBudget <= 0) {
      throw new Error('Budget must be positive');
    }

    if (this.status !== 'active') {
      throw new Error('Can only scale active campaigns');
    }

    if (!this.isReadyForScaling()) {
      throw new Error('Campaign is not ready for scaling');
    }

    this.budget = newBudget;
  }

  /**
   * Gets campaign performance summary
   */
  public getPerformanceSummary(): {
    roas: number;
    profit: number;
    profitMargin: number;
    efficiency: 'excellent' | 'good' | 'poor' | 'losing';
    recommendation: string;
  } {
    const profit = this.revenue - this.spend;
    const profitMargin = this.revenue > 0 ? (profit / this.revenue) * 100 : 0;

    let efficiency: 'excellent' | 'good' | 'poor' | 'losing';
    let recommendation: string;

    if (this.roas >= 3.0) {
      efficiency = 'excellent';
      recommendation = 'Scale aggressively';
    } else if (this.roas >= 2.0) {
      efficiency = 'good';
      recommendation = 'Scale moderately';
    } else if (this.roas >= 1.0) {
      efficiency = 'poor';
      recommendation = 'Optimize or pause';
    } else {
      efficiency = 'losing';
      recommendation = 'Kill immediately';
    }

    return {
      roas: this.roas,
      profit,
      profitMargin,
      efficiency,
      recommendation,
    };
  }

  /**
   * Gets conversion rate if data is available
   */
  public getConversionRate(): number | null {
    if (this.clicks && this.conversions !== undefined) {
      return this.clicks > 0 ? (this.conversions / this.clicks) * 100 : 0;
    }
    return null;
  }

  /**
   * Serializes campaign to JSON
   */
  public toJSON(): ICampaign {
    return {
      id: this.id,
      productId: this.productId,
      platform: this.platform,
      angle: this.angle,
      budget: this.budget,
      spend: this.spend,
      revenue: this.revenue,
      roas: this.roas,
      status: this.status,
      createdDay: this.createdDay,
      lastOptimized: this.lastOptimized,
      impressions: this.impressions,
      clicks: this.clicks,
      conversions: this.conversions,
      ctr: this.ctr,
      cpc: this.cpc,
    };
  }

  /**
   * Creates Campaign instance from JSON data
   */
  public static fromJSON(data: ICampaign): Campaign {
    return new Campaign(data);
  }

  /**
   * Validates campaign data without creating instance
   */
  public static validate(data: unknown): data is ICampaign {
    try {
      CampaignSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }
}