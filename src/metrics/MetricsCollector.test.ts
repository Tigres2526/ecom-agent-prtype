import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsCollector } from './MetricsCollector.js';
import { MemoryStore } from '../memory/MemoryStore.js';
import { AgentState } from '../models/AgentState.js';
import type { MetricSnapshot } from '../types/index.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  let memoryStore: MemoryStore;
  let mockAgentState: AgentState;

  beforeEach(() => {
    memoryStore = new MemoryStore();
    collector = new MetricsCollector(memoryStore);
    
    // Create a mock agent state
    mockAgentState = new AgentState(1000, 50, 10);
    mockAgentState.currentDay = 5;
    mockAgentState.netWorth = 1200;
    mockAgentState.totalRevenue = 500;
    mockAgentState.totalSpend = 300;
    mockAgentState.currentROAS = 1.67;
    mockAgentState.errorCount = 2;
  });

  describe('recordMetric', () => {
    it('should record a metric with metadata', () => {
      collector.recordMetric('net_worth', 1000, { day: 1 });
      
      const metrics = collector.getMetrics('net_worth');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(1000);
      expect(metrics[0].metadata?.day).toBe(1);
    });

    it('should store metrics in memory store', () => {
      const spy = vi.spyOn(memoryStore, 'writeScratchpad');
      
      collector.recordMetric('total_revenue', 500);
      
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('metric_'),
        expect.any(String),
        0,
        'metric'
      );
    });

    it('should group metrics by date', () => {
      collector.recordMetric('current_roas', 2.0);
      collector.recordMetric('current_roas', 2.5);
      
      const metrics = collector.getMetrics('current_roas');
      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(2.0);
      expect(metrics[1].value).toBe(2.5);
    });
  });

  describe('recordStateMetrics', () => {
    it('should record all state metrics', () => {
      collector.recordStateMetrics(mockAgentState);
      
      expect(collector.getMetrics('net_worth')).toHaveLength(1);
      expect(collector.getMetrics('total_revenue')).toHaveLength(1);
      expect(collector.getMetrics('total_spend')).toHaveLength(1);
      expect(collector.getMetrics('current_roas')).toHaveLength(1);
      expect(collector.getMetrics('error_count')).toHaveLength(1);
      
      const netWorthMetric = collector.getMetrics('net_worth')[0];
      expect(netWorthMetric.value).toBe(1200);
      expect(netWorthMetric.metadata?.day).toBe(5);
    });

    it('should count active campaigns and products', () => {
      // Add some test campaigns and products
      mockAgentState.addCampaign({
        id: 'camp1',
        productId: 'prod1',
        platform: 'facebook',
        angle: 'test',
        budget: 50,
        spend: 0,
        revenue: 0,
        roas: 0,
        status: 'active',
        createdDay: 1,
        lastOptimized: 1
      });
      
      mockAgentState.addProduct({
        id: 'prod1',
        name: 'Test Product',
        sourceUrl: 'http://test.com',
        supplierPrice: 10,
        recommendedPrice: 30,
        margin: 20,
        contentScore: 0.8,
        competitorCount: 5,
        status: 'active',
        createdDay: 1
      });
      
      collector.recordStateMetrics(mockAgentState);
      
      const campaignMetrics = collector.getMetrics('active_campaigns');
      const productMetrics = collector.getMetrics('active_products');
      
      expect(campaignMetrics[0].value).toBe(1);
      expect(productMetrics[0].value).toBe(1);
    });
  });

  describe('recordCampaignMetrics', () => {
    it('should record campaign performance metrics', () => {
      collector.recordCampaignMetrics('camp1', {
        revenue: 100,
        spend: 50,
        roas: 2.0,
        conversions: 5
      });
      
      const revenueMetrics = collector.getMetrics('campaign_revenue');
      const spendMetrics = collector.getMetrics('campaign_spend');
      const conversionMetrics = collector.getMetrics('campaign_conversions');
      
      expect(revenueMetrics).toHaveLength(1);
      expect(revenueMetrics[0].value).toBe(100);
      expect(revenueMetrics[0].metadata?.campaignId).toBe('camp1');
      expect(revenueMetrics[0].metadata?.roas).toBe(2.0);
      
      expect(spendMetrics[0].value).toBe(50);
      expect(conversionMetrics[0].value).toBe(5);
    });
  });

  describe('recordProductMetrics', () => {
    it('should record product performance metrics', () => {
      collector.recordProductMetrics('prod1', {
        sales: 10,
        revenue: 300,
        margin: 20
      });
      
      const salesMetrics = collector.getMetrics('product_sales');
      const revenueMetrics = collector.getMetrics('product_revenue');
      
      expect(salesMetrics).toHaveLength(1);
      expect(salesMetrics[0].value).toBe(10);
      expect(salesMetrics[0].metadata?.productId).toBe('prod1');
      
      expect(revenueMetrics[0].value).toBe(300);
      expect(revenueMetrics[0].metadata?.margin).toBe(20);
    });
  });

  describe('recordDecisionMetrics', () => {
    it('should record decision performance metrics', () => {
      collector.recordDecisionMetrics({
        type: 'scale_campaign',
        confidence: 0.85,
        executionTime: 1500,
        success: true
      });
      
      const confidenceMetrics = collector.getMetrics('decision_confidence');
      const timeMetrics = collector.getMetrics('decision_time');
      
      expect(confidenceMetrics).toHaveLength(1);
      expect(confidenceMetrics[0].value).toBe(0.85);
      expect(confidenceMetrics[0].metadata?.type).toBe('scale_campaign');
      expect(confidenceMetrics[0].metadata?.success).toBe(true);
      
      expect(timeMetrics[0].value).toBe(1500);
    });
  });

  describe('getMetrics', () => {
    it('should filter metrics by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      collector.recordMetric('net_worth', 1000);
      collector.recordMetric('net_worth', 1100);
      collector.recordMetric('net_worth', 1200);
      
      const allMetrics = collector.getMetrics('net_worth');
      expect(allMetrics).toHaveLength(3);
      
      const todayMetrics = collector.getMetrics('net_worth', yesterday, tomorrow);
      expect(todayMetrics).toHaveLength(3);
      
      const futureMetrics = collector.getMetrics('net_worth', tomorrow);
      expect(futureMetrics).toHaveLength(0);
    });

    it('should return metrics sorted by timestamp', () => {
      // Record metrics with slight delays to ensure different timestamps
      collector.recordMetric('net_worth', 1000);
      collector.recordMetric('net_worth', 1100);
      collector.recordMetric('net_worth', 1200);
      
      const metrics = collector.getMetrics('net_worth');
      
      expect(metrics[0].value).toBe(1000);
      expect(metrics[1].value).toBe(1100);
      expect(metrics[2].value).toBe(1200);
      
      // Verify chronological order
      for (let i = 1; i < metrics.length; i++) {
        expect(metrics[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          metrics[i - 1].timestamp.getTime()
        );
      }
    });
  });

  describe('getAverageMetric', () => {
    it('should calculate average metric value', () => {
      collector.recordMetric('current_roas', 2.0);
      collector.recordMetric('current_roas', 2.5);
      collector.recordMetric('current_roas', 3.0);
      
      const average = collector.getAverageMetric('current_roas');
      expect(average).toBe(2.5);
    });

    it('should return 0 for no metrics', () => {
      const average = collector.getAverageMetric('current_roas');
      expect(average).toBe(0);
    });
  });

  describe('getMetricTrend', () => {
    it('should calculate metric trends', () => {
      // Record metrics with controlled timestamps
      const now = new Date();
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      // Manually create metrics with specific timestamps
      const oldMetric: MetricSnapshot = {
        type: 'net_worth',
        value: 1000,
        timestamp: sixDaysAgo,
        metadata: {}
      };
      
      const newMetric: MetricSnapshot = {
        type: 'net_worth',
        value: 1200,
        timestamp: twoDaysAgo,
        metadata: {}
      };
      
      // Inject metrics directly into the collector's map
      const key = `net_worth_${collector['getDateKey']()}`;
      collector['metrics'].set(key, [oldMetric, newMetric]);
      
      const trend = collector.getMetricTrend('net_worth', 7);
      
      expect(trend.previous).toBe(1000);
      expect(trend.current).toBe(1200);
      expect(trend.change).toBe(20); // 20% increase
      expect(trend.trend).toBe('up');
    });

    it('should detect downward trends', () => {
      // Record metrics with controlled timestamps
      const now = new Date();
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      // Manually create metrics with specific timestamps
      const oldMetric: MetricSnapshot = {
        type: 'error_count',
        value: 10,
        timestamp: sixDaysAgo,
        metadata: {}
      };
      
      const newMetric: MetricSnapshot = {
        type: 'error_count',
        value: 5,
        timestamp: twoDaysAgo,
        metadata: {}
      };
      
      // Inject metrics directly into the collector's map
      const key = `error_count_${collector['getDateKey']()}`;
      collector['metrics'].set(key, [oldMetric, newMetric]);
      
      const trend = collector.getMetricTrend('error_count', 7);
      
      expect(trend.change).toBe(-50);
      expect(trend.trend).toBe('down');
    });

    it('should detect stable trends', () => {
      collector.recordMetric('active_campaigns', 5);
      collector.recordMetric('active_campaigns', 5);
      
      const trend = collector.getMetricTrend('active_campaigns');
      
      expect(trend.change).toBe(0);
      expect(trend.trend).toBe('stable');
    });
  });

  describe('generatePerformanceReport', () => {
    it('should generate comprehensive performance report', () => {
      // Add test data
      collector.recordStateMetrics(mockAgentState);
      
      collector.recordCampaignMetrics('camp1', {
        revenue: 100,
        spend: 50,
        roas: 2.0,
        conversions: 5
      });
      
      collector.recordProductMetrics('prod1', {
        sales: 10,
        revenue: 300,
        margin: 20
      });
      
      const report = collector.generatePerformanceReport(mockAgentState);
      
      expect(report.summary).toBeDefined();
      expect(report.summary.currentDay).toBe(5);
      expect(report.summary.netWorth).toBe(1200);
      
      expect(report.trends).toBeDefined();
      expect(report.trends.netWorth).toBeDefined();
      expect(report.trends.roas).toBeDefined();
      
      expect(report.topPerformers).toBeDefined();
      expect(report.topPerformers.campaigns).toBeInstanceOf(Array);
      expect(report.topPerformers.products).toBeInstanceOf(Array);
      
      expect(report.alerts).toBeInstanceOf(Array);
    });

    it('should generate appropriate alerts', () => {
      // Set up poor performance state
      mockAgentState.currentROAS = 1.2; // Below target
      mockAgentState.errorCount = 50;
      
      // Add losing campaigns
      for (let i = 0; i < 5; i++) {
        mockAgentState.addCampaign({
          id: `camp${i}`,
          productId: 'prod1',
          platform: 'facebook',
          angle: 'test',
          budget: 50,
          spend: 100,
          revenue: 80,
          roas: 0.8,
          status: 'active',
          createdDay: 1,
          lastOptimized: 1
        });
      }
      
      collector.recordStateMetrics(mockAgentState);
      
      const report = collector.generatePerformanceReport(mockAgentState);
      
      expect(report.alerts.length).toBeGreaterThan(0);
      expect(report.alerts.some(a => a.includes('ROAS'))).toBe(true);
      expect(report.alerts.some(a => a.includes('negative ROI'))).toBe(true);
    });
  });

  describe('exportMetricsCSV', () => {
    it('should export metrics to CSV format', () => {
      collector.recordMetric('net_worth', 1000, { day: 1 });
      collector.recordMetric('net_worth', 1100, { day: 2 });
      
      const csv = collector.exportMetricsCSV('net_worth');
      
      expect(csv).toContain('timestamp,value,day');
      expect(csv).toContain('1000,1');
      expect(csv).toContain('1100,2');
    });

    it('should handle metrics without metadata', () => {
      collector.recordMetric('total_spend', 500);
      
      const csv = collector.exportMetricsCSV('total_spend');
      
      expect(csv).toContain('timestamp,value');
      expect(csv).toContain('500');
    });

    it('should return empty string for no metrics', () => {
      const csv = collector.exportMetricsCSV('net_worth');
      expect(csv).toBe('');
    });
  });

  describe('pruneOldMetrics', () => {
    it('should remove metrics older than specified days', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      
      // Create metrics with specific timestamps
      const oldMetric: MetricSnapshot = {
        type: 'net_worth',
        value: 1000,
        timestamp: oldDate,
        metadata: {}
      };
      
      const recentMetric: MetricSnapshot = {
        type: 'net_worth',
        value: 1200,
        timestamp: recentDate,
        metadata: {}
      };
      
      // Inject metrics directly
      const key = `net_worth_${collector['getDateKey']()}`;
      collector['metrics'].set(key, [oldMetric, recentMetric]);
      
      // Prune metrics older than 30 days
      collector.pruneOldMetrics(30);
      
      const metrics = collector.getMetrics('net_worth');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(1200);
    });

    it('should keep all metrics within retention period', () => {
      collector.recordMetric('net_worth', 1000);
      collector.recordMetric('net_worth', 1100);
      collector.recordMetric('net_worth', 1200);
      
      collector.pruneOldMetrics(30);
      
      const metrics = collector.getMetrics('net_worth');
      expect(metrics).toHaveLength(3);
    });
  });
});