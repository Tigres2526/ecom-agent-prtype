import type { AgentState } from '../models/AgentState.js';
import type { MetricType, MetricSnapshot, PerformanceReport } from '../types/index.js';
import { MemoryStore } from '../memory/MemoryStore.js';

/**
 * Collects and aggregates metrics from agent operations
 */
export class MetricsCollector {
  private memoryStore: MemoryStore;
  private metrics: Map<string, MetricSnapshot[]> = new Map();
  
  constructor(memoryStore: MemoryStore) {
    this.memoryStore = memoryStore;
  }

  /**
   * Records a metric data point
   */
  public recordMetric(
    type: MetricType,
    value: number,
    metadata?: Record<string, any>
  ): void {
    const snapshot: MetricSnapshot = {
      type,
      value,
      timestamp: new Date(),
      metadata
    };

    const key = `${type}_${this.getDateKey()}`;
    const existing = this.metrics.get(key) || [];
    existing.push(snapshot);
    this.metrics.set(key, existing);

    // Also store in memory for persistence
    this.memoryStore.writeScratchpad(
      `metric_${Date.now()}`,
      JSON.stringify(snapshot),
      0, // Day 0 for global metrics
      'metric'
    );
  }

  /**
   * Records agent state metrics
   */
  public recordStateMetrics(state: AgentState): void {
    this.recordMetric('net_worth', state.netWorth, {
      day: state.currentDay
    });
    
    this.recordMetric('total_revenue', state.totalRevenue, {
      day: state.currentDay
    });
    
    this.recordMetric('total_spend', state.totalSpend, {
      day: state.currentDay
    });
    
    this.recordMetric('current_roas', state.currentROAS, {
      day: state.currentDay
    });
    
    this.recordMetric('active_campaigns', 
      state.activeCampaigns.filter(c => c.status === 'active').length,
      { day: state.currentDay }
    );
    
    this.recordMetric('active_products',
      state.activeProducts.filter(p => p.status !== 'killed').length,
      { day: state.currentDay }
    );
    
    this.recordMetric('error_count', state.errorCount, {
      day: state.currentDay
    });
  }

  /**
   * Records campaign performance metrics
   */
  public recordCampaignMetrics(campaignId: string, metrics: {
    revenue: number;
    spend: number;
    roas: number;
    conversions: number;
  }): void {
    this.recordMetric('campaign_revenue', metrics.revenue, {
      campaignId,
      roas: metrics.roas
    });
    
    this.recordMetric('campaign_spend', metrics.spend, {
      campaignId
    });
    
    this.recordMetric('campaign_conversions', metrics.conversions, {
      campaignId
    });
  }

  /**
   * Records product performance metrics
   */
  public recordProductMetrics(productId: string, metrics: {
    sales: number;
    revenue: number;
    margin: number;
  }): void {
    this.recordMetric('product_sales', metrics.sales, {
      productId
    });
    
    this.recordMetric('product_revenue', metrics.revenue, {
      productId,
      margin: metrics.margin
    });
  }

  /**
   * Records decision metrics
   */
  public recordDecisionMetrics(decision: {
    type: string;
    confidence: number;
    executionTime: number;
    success: boolean;
  }): void {
    this.recordMetric('decision_confidence', decision.confidence, {
      type: decision.type,
      success: decision.success
    });
    
    this.recordMetric('decision_time', decision.executionTime, {
      type: decision.type
    });
  }

  /**
   * Gets aggregated metrics for a time period
   */
  public getMetrics(
    type: MetricType,
    startDate?: Date,
    endDate?: Date
  ): MetricSnapshot[] {
    const results: MetricSnapshot[] = [];
    
    for (const [key, snapshots] of this.metrics) {
      if (!key.startsWith(type)) continue;
      
      for (const snapshot of snapshots) {
        if (startDate && snapshot.timestamp < startDate) continue;
        if (endDate && snapshot.timestamp > endDate) continue;
        results.push(snapshot);
      }
    }
    
    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Calculates average metric value
   */
  public getAverageMetric(
    type: MetricType,
    startDate?: Date,
    endDate?: Date
  ): number {
    const metrics = this.getMetrics(type, startDate, endDate);
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  /**
   * Calculates metric trends
   */
  public getMetricTrend(
    type: MetricType,
    days: number = 7
  ): {
    current: number;
    previous: number;
    change: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const now = new Date();
    const midPoint = new Date(now.getTime() - (days / 2) * 24 * 60 * 60 * 1000);
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    const currentMetrics = this.getMetrics(type, midPoint, now);
    const previousMetrics = this.getMetrics(type, startDate, midPoint);
    
    const current = currentMetrics.length > 0
      ? currentMetrics.reduce((sum, m) => sum + m.value, 0) / currentMetrics.length
      : 0;
      
    const previous = previousMetrics.length > 0
      ? previousMetrics.reduce((sum, m) => sum + m.value, 0) / previousMetrics.length
      : 0;
    
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (change > 5) trend = 'up';
    else if (change < -5) trend = 'down';
    
    return { current, previous, change, trend };
  }

  /**
   * Generates a performance report
   */
  public generatePerformanceReport(state: AgentState): PerformanceReport {
    const netWorthTrend = this.getMetricTrend('net_worth');
    const roasTrend = this.getMetricTrend('current_roas');
    const revenueTrend = this.getMetricTrend('total_revenue');
    const errorTrend = this.getMetricTrend('error_count');
    
    // Calculate best performing campaigns
    const campaignMetrics = this.getMetrics('campaign_revenue');
    const campaignPerformance = new Map<string, { revenue: number; count: number }>();
    
    for (const metric of campaignMetrics) {
      const campaignId = metric.metadata?.campaignId;
      if (!campaignId) continue;
      
      const existing = campaignPerformance.get(campaignId) || { revenue: 0, count: 0 };
      existing.revenue += metric.value;
      existing.count++;
      campaignPerformance.set(campaignId, existing);
    }
    
    const topCampaigns = Array.from(campaignPerformance.entries())
      .map(([id, data]) => ({ id, avgRevenue: data.revenue / data.count }))
      .sort((a, b) => b.avgRevenue - a.avgRevenue)
      .slice(0, 5);
    
    // Calculate best performing products
    const productMetrics = this.getMetrics('product_revenue');
    const productPerformance = new Map<string, number>();
    
    for (const metric of productMetrics) {
      const productId = metric.metadata?.productId;
      if (!productId) continue;
      
      const existing = productPerformance.get(productId) || 0;
      productPerformance.set(productId, existing + metric.value);
    }
    
    const topProducts = Array.from(productPerformance.entries())
      .map(([id, revenue]) => ({ id, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    return {
      summary: {
        currentDay: state.currentDay,
        netWorth: state.netWorth,
        totalRevenue: state.totalRevenue,
        totalSpend: state.totalSpend,
        overallROAS: state.currentROAS,
        activeCampaigns: state.activeCampaigns.filter(c => c.status === 'active').length,
        activeProducts: state.activeProducts.filter(p => p.status !== 'killed').length,
      },
      trends: {
        netWorth: netWorthTrend,
        roas: roasTrend,
        revenue: revenueTrend,
        errors: errorTrend,
      },
      topPerformers: {
        campaigns: topCampaigns,
        products: topProducts,
      },
      alerts: this.generateAlerts(state, {
        netWorthTrend,
        roasTrend,
        revenueTrend,
        errorTrend
      })
    };
  }

  /**
   * Generates performance alerts
   */
  private generateAlerts(
    state: AgentState,
    trends: Record<string, any>
  ): string[] {
    const alerts: string[] = [];
    
    // Net worth alerts
    if (trends.netWorthTrend.trend === 'down' && trends.netWorthTrend.change < -10) {
      alerts.push(`⚠️ Net worth declining rapidly: ${trends.netWorthTrend.change.toFixed(1)}%`);
    }
    
    // ROAS alerts
    if (state.currentROAS < 1.5) {
      alerts.push(`⚠️ Current ROAS (${state.currentROAS.toFixed(2)}) below target`);
    }
    
    // Error rate alerts
    if (trends.errorTrend.trend === 'up' && trends.errorTrend.change > 50) {
      alerts.push(`⚠️ Error rate increasing: ${trends.errorTrend.change.toFixed(1)}%`);
    }
    
    // Campaign performance alerts
    const losingCampaigns = state.activeCampaigns.filter(
      c => c.status === 'active' && c.roas < 1.0
    );
    if (losingCampaigns.length > 3) {
      alerts.push(`⚠️ ${losingCampaigns.length} campaigns with negative ROI`);
    }
    
    return alerts;
  }

  /**
   * Exports metrics to CSV format
   */
  public exportMetricsCSV(type: MetricType): string {
    const metrics = this.getMetrics(type);
    if (metrics.length === 0) return '';
    
    // Build CSV header
    const headers = ['timestamp', 'value'];
    const metadataKeys = new Set<string>();
    
    for (const metric of metrics) {
      if (metric.metadata) {
        Object.keys(metric.metadata).forEach(key => metadataKeys.add(key));
      }
    }
    
    headers.push(...Array.from(metadataKeys));
    
    // Build CSV rows
    const rows = [headers.join(',')];
    
    for (const metric of metrics) {
      const row = [
        metric.timestamp.toISOString(),
        metric.value.toString()
      ];
      
      for (const key of metadataKeys) {
        row.push(metric.metadata?.[key]?.toString() || '');
      }
      
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  /**
   * Clears old metrics to save memory
   */
  public pruneOldMetrics(daysToKeep: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    for (const [key, snapshots] of this.metrics) {
      const filtered = snapshots.filter(s => s.timestamp > cutoffDate);
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    }
  }

  /**
   * Gets a date key for grouping metrics
   */
  private getDateKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}