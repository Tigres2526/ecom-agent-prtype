import { MetricsCollector } from './MetricsCollector.js';
import type { PerformanceReport, DailyMetrics } from '../types/index.js';
import { AgentState } from '../models/AgentState.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Generates various reports from collected metrics
 */
export class ReportGenerator {
  private metricsCollector: MetricsCollector;
  
  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * Generates a daily report
   */
  public generateDailyReport(state: AgentState): string {
    const report = this.metricsCollector.generatePerformanceReport(state);
    const date = new Date().toLocaleDateString();
    
    let output = `# Daily Report - Day ${state.currentDay} (${date})\n\n`;
    
    // Summary Section
    output += '## Summary\n';
    output += `- Net Worth: $${report.summary.netWorth.toFixed(2)}\n`;
    output += `- Total Revenue: $${report.summary.totalRevenue.toFixed(2)}\n`;
    output += `- Total Spend: $${report.summary.totalSpend.toFixed(2)}\n`;
    output += `- Overall ROAS: ${report.summary.overallROAS.toFixed(2)}x\n`;
    output += `- Active Campaigns: ${report.summary.activeCampaigns}\n`;
    output += `- Active Products: ${report.summary.activeProducts}\n\n`;
    
    // Trends Section
    output += '## Trends\n';
    output += this.formatTrend('Net Worth', report.trends.netWorth);
    output += this.formatTrend('ROAS', report.trends.roas);
    output += this.formatTrend('Revenue', report.trends.revenue);
    output += this.formatTrend('Errors', report.trends.errors);
    output += '\n';
    
    // Top Performers
    if (report.topPerformers.campaigns.length > 0) {
      output += '## Top Campaigns\n';
      report.topPerformers.campaigns.forEach((campaign, i) => {
        output += `${i + 1}. ${campaign.id}: $${campaign.avgRevenue.toFixed(2)} avg revenue\n`;
      });
      output += '\n';
    }
    
    if (report.topPerformers.products.length > 0) {
      output += '## Top Products\n';
      report.topPerformers.products.forEach((product, i) => {
        output += `${i + 1}. ${product.id}: $${product.revenue.toFixed(2)} total revenue\n`;
      });
      output += '\n';
    }
    
    // Alerts
    if (report.alerts.length > 0) {
      output += '## Alerts\n';
      report.alerts.forEach(alert => {
        output += `- ${alert}\n`;
      });
      output += '\n';
    }
    
    return output;
  }

  /**
   * Generates a weekly summary report
   */
  public generateWeeklyReport(state: AgentState, days: number = 7): string {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    let output = `# Weekly Report - Days ${Math.max(1, state.currentDay - days + 1)}-${state.currentDay}\n\n`;
    
    // Week Overview
    output += '## Week Overview\n';
    
    // Calculate weekly metrics
    const netWorthMetrics = this.metricsCollector.getMetrics('net_worth', startDate);
    const revenueMetrics = this.metricsCollector.getMetrics('total_revenue', startDate);
    const spendMetrics = this.metricsCollector.getMetrics('total_spend', startDate);
    
    const weekStartNetWorth = netWorthMetrics.length > 0 ? netWorthMetrics[0].value : state.netWorth;
    const weeklyGrowth = ((state.netWorth - weekStartNetWorth) / weekStartNetWorth) * 100;
    
    const weeklyRevenue = revenueMetrics.reduce((sum, m) => sum + m.value, 0);
    const weeklySpend = spendMetrics.reduce((sum, m) => sum + m.value, 0);
    const weeklyROAS = weeklySpend > 0 ? weeklyRevenue / weeklySpend : 0;
    
    output += `- Weekly Growth: ${weeklyGrowth.toFixed(2)}%\n`;
    output += `- Weekly Revenue: $${weeklyRevenue.toFixed(2)}\n`;
    output += `- Weekly Spend: $${weeklySpend.toFixed(2)}\n`;
    output += `- Weekly ROAS: ${weeklyROAS.toFixed(2)}x\n\n`;
    
    // Campaign Performance
    output += '## Campaign Performance\n';
    const campaignRevenues = this.metricsCollector.getMetrics('campaign_revenue', startDate);
    const campaignMap = new Map<string, { revenue: number; count: number }>();
    
    campaignRevenues.forEach(metric => {
      const id = metric.metadata?.campaignId;
      if (id) {
        const existing = campaignMap.get(id) || { revenue: 0, count: 0 };
        existing.revenue += metric.value;
        existing.count++;
        campaignMap.set(id, existing);
      }
    });
    
    const sortedCampaigns = Array.from(campaignMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10);
    
    sortedCampaigns.forEach(([id, data]) => {
      output += `- ${id}: $${data.revenue.toFixed(2)} total, ${data.count} updates\n`;
    });
    output += '\n';
    
    // Decision Analysis
    output += '## Decision Analysis\n';
    const decisionMetrics = this.metricsCollector.getMetrics('decision_confidence', startDate);
    const decisionTypes = new Map<string, { count: number; avgConfidence: number; successRate: number }>();
    
    decisionMetrics.forEach(metric => {
      const type = metric.metadata?.type;
      if (type) {
        const existing = decisionTypes.get(type) || { count: 0, avgConfidence: 0, successRate: 0 };
        existing.count++;
        existing.avgConfidence += metric.value;
        if (metric.metadata?.success) {
          existing.successRate++;
        }
        decisionTypes.set(type, existing);
      }
    });
    
    decisionTypes.forEach((data, type) => {
      data.avgConfidence /= data.count;
      data.successRate = (data.successRate / data.count) * 100;
      output += `- ${type}: ${data.count} decisions, ${data.avgConfidence.toFixed(2)} avg confidence, ${data.successRate.toFixed(0)}% success\n`;
    });
    output += '\n';
    
    return output;
  }

  /**
   * Generates a CSV export of all metrics
   */
  public exportAllMetricsCSV(outputDir: string): void {
    const metricTypes: Array<import('../types/index.js').MetricType> = [
      'net_worth', 'total_revenue', 'total_spend', 'current_roas',
      'active_campaigns', 'active_products', 'error_count',
      'campaign_revenue', 'campaign_spend', 'campaign_conversions',
      'product_sales', 'product_revenue',
      'decision_confidence', 'decision_time'
    ];
    
    metricTypes.forEach(type => {
      const csv = this.metricsCollector.exportMetricsCSV(type);
      if (csv) {
        const filename = join(outputDir, `metrics_${type}_${Date.now()}.csv`);
        writeFileSync(filename, csv, 'utf-8');
      }
    });
  }

  /**
   * Generates an HTML dashboard
   */
  public generateHTMLDashboard(state: AgentState): string {
    const report = this.metricsCollector.generatePerformanceReport(state);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Dropshipping Agent Dashboard - Day ${state.currentDay}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 24px; font-weight: bold; color: #333; }
    .metric-label { font-size: 14px; color: #666; }
    .trend { display: inline-block; margin-left: 10px; font-size: 14px; }
    .trend.up { color: #4CAF50; }
    .trend.down { color: #f44336; }
    .trend.stable { color: #999; }
    .alert { background: #fff3cd; color: #856404; padding: 10px; margin: 5px 0; border-radius: 4px; }
    .chart { height: 300px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Dropshipping Agent Dashboard</h1>
    <p>Day ${state.currentDay} - ${new Date().toLocaleString()}</p>
    
    <div class="card">
      <h2>Key Metrics</h2>
      <div class="metric">
        <div class="metric-label">Net Worth</div>
        <div class="metric-value">$${report.summary.netWorth.toFixed(2)}</div>
        ${this.formatTrendHTML(report.trends.netWorth)}
      </div>
      <div class="metric">
        <div class="metric-label">Current ROAS</div>
        <div class="metric-value">${report.summary.overallROAS.toFixed(2)}x</div>
        ${this.formatTrendHTML(report.trends.roas)}
      </div>
      <div class="metric">
        <div class="metric-label">Total Revenue</div>
        <div class="metric-value">$${report.summary.totalRevenue.toFixed(2)}</div>
        ${this.formatTrendHTML(report.trends.revenue)}
      </div>
      <div class="metric">
        <div class="metric-label">Active Campaigns</div>
        <div class="metric-value">${report.summary.activeCampaigns}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Active Products</div>
        <div class="metric-value">${report.summary.activeProducts}</div>
      </div>
    </div>
    
    ${report.alerts.length > 0 ? `
    <div class="card">
      <h2>Alerts</h2>
      ${report.alerts.map(alert => `<div class="alert">${alert}</div>`).join('')}
    </div>
    ` : ''}
    
    ${report.topPerformers.campaigns.length > 0 ? `
    <div class="card">
      <h2>Top Campaigns</h2>
      <table>
        <tr>
          <th>Campaign ID</th>
          <th>Average Revenue</th>
        </tr>
        ${report.topPerformers.campaigns.map(c => `
        <tr>
          <td>${c.id}</td>
          <td>$${c.avgRevenue.toFixed(2)}</td>
        </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}
    
    ${report.topPerformers.products.length > 0 ? `
    <div class="card">
      <h2>Top Products</h2>
      <table>
        <tr>
          <th>Product ID</th>
          <th>Total Revenue</th>
        </tr>
        ${report.topPerformers.products.map(p => `
        <tr>
          <td>${p.id}</td>
          <td>$${p.revenue.toFixed(2)}</td>
        </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}
    
    <div class="card">
      <h2>Recent Decisions</h2>
      <div id="decisions-chart" class="chart">
        <!-- Chart would be rendered here with a charting library -->
        <p style="color: #999; text-align: center; padding: 100px 0;">
          Chart visualization would be rendered here
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generates a JSON report for API consumption
   */
  public generateJSONReport(state: AgentState): object {
    const report = this.metricsCollector.generatePerformanceReport(state);
    const dailyMetrics = this.getDailyMetricsHistory(state, 30);
    
    return {
      timestamp: new Date().toISOString(),
      day: state.currentDay,
      summary: report.summary,
      trends: report.trends,
      topPerformers: report.topPerformers,
      alerts: report.alerts,
      history: {
        daily: dailyMetrics,
        weekly: this.getWeeklyAggregates(dailyMetrics)
      },
      metadata: {
        agentVersion: '1.0.0',
        reportVersion: '1.0.0'
      }
    };
  }

  /**
   * Formats a trend for text output
   */
  private formatTrend(label: string, trend: any): string {
    const arrow = trend.trend === 'up' ? '↑' : trend.trend === 'down' ? '↓' : '→';
    const sign = trend.change >= 0 ? '+' : '';
    return `- ${label}: ${trend.current.toFixed(2)} ${arrow} (${sign}${trend.change.toFixed(1)}%)\n`;
  }

  /**
   * Formats a trend for HTML output
   */
  private formatTrendHTML(trend: any): string {
    const arrow = trend.trend === 'up' ? '↑' : trend.trend === 'down' ? '↓' : '→';
    const sign = trend.change >= 0 ? '+' : '';
    return `<span class="trend ${trend.trend}">${arrow} ${sign}${trend.change.toFixed(1)}%</span>`;
  }

  /**
   * Gets daily metrics history
   */
  private getDailyMetricsHistory(state: AgentState, days: number): DailyMetrics[] {
    const history: DailyMetrics[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Get all relevant metrics
    const netWorthMetrics = this.metricsCollector.getMetrics('net_worth', startDate);
    const revenueMetrics = this.metricsCollector.getMetrics('total_revenue', startDate);
    const spendMetrics = this.metricsCollector.getMetrics('total_spend', startDate);
    const roasMetrics = this.metricsCollector.getMetrics('current_roas', startDate);
    
    // Group by day
    const dayMap = new Map<number, DailyMetrics>();
    
    netWorthMetrics.forEach(m => {
      const day = m.metadata?.day || 0;
      if (!dayMap.has(day)) {
        dayMap.set(day, this.createEmptyDailyMetrics(day));
      }
      dayMap.get(day)!.netWorth = m.value;
    });
    
    revenueMetrics.forEach(m => {
      const day = m.metadata?.day || 0;
      if (!dayMap.has(day)) {
        dayMap.set(day, this.createEmptyDailyMetrics(day));
      }
      dayMap.get(day)!.revenue = m.value;
    });
    
    spendMetrics.forEach(m => {
      const day = m.metadata?.day || 0;
      if (!dayMap.has(day)) {
        dayMap.set(day, this.createEmptyDailyMetrics(day));
      }
      dayMap.get(day)!.spend = m.value;
    });
    
    roasMetrics.forEach(m => {
      const day = m.metadata?.day || 0;
      if (!dayMap.has(day)) {
        dayMap.set(day, this.createEmptyDailyMetrics(day));
      }
      dayMap.get(day)!.roas = m.value;
    });
    
    return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
  }

  /**
   * Creates an empty daily metrics object
   */
  private createEmptyDailyMetrics(day: number): DailyMetrics {
    return {
      day,
      netWorth: 0,
      revenue: 0,
      spend: 0,
      roas: 0,
      activeProducts: 0,
      activeCampaigns: 0,
      newProducts: 0,
      killedCampaigns: 0,
      scaledCampaigns: 0,
      errors: 0
    };
  }

  /**
   * Calculates weekly aggregates from daily metrics
   */
  private getWeeklyAggregates(dailyMetrics: DailyMetrics[]): Array<{
    week: number;
    avgNetWorth: number;
    totalRevenue: number;
    totalSpend: number;
    avgROAS: number;
  }> {
    const weeks: Map<number, DailyMetrics[]> = new Map();
    
    dailyMetrics.forEach(day => {
      const week = Math.floor((day.day - 1) / 7) + 1;
      if (!weeks.has(week)) {
        weeks.set(week, []);
      }
      weeks.get(week)!.push(day);
    });
    
    return Array.from(weeks.entries()).map(([week, days]) => ({
      week,
      avgNetWorth: days.reduce((sum, d) => sum + d.netWorth, 0) / days.length,
      totalRevenue: days.reduce((sum, d) => sum + d.revenue, 0),
      totalSpend: days.reduce((sum, d) => sum + d.spend, 0),
      avgROAS: days.reduce((sum, d) => sum + d.roas, 0) / days.length
    }));
  }
}