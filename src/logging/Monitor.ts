import { EventEmitter } from 'events';
import { Logger, LogLevel } from './Logger.js';

export interface MetricPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'rate';
  points: MetricPoint[];
  unit?: string;
  description?: string;
}

export interface Alert {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  currentValue: number;
  triggered: boolean;
  triggeredAt?: Date;
  resolvedAt?: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MonitorConfig {
  metricsRetentionHours: number;
  aggregationIntervalMs: number;
  alertCheckIntervalMs: number;
  maxMetricPoints: number;
}

export class Monitor extends EventEmitter {
  private logger: Logger;
  private config: MonitorConfig;
  private metrics: Map<string, Metric> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private aggregationInterval: NodeJS.Timeout | null = null;
  private alertInterval: NodeJS.Timeout | null = null;
  private startTime: Date;

  constructor(logger: Logger, config: Partial<MonitorConfig> = {}) {
    super();
    
    this.logger = logger;
    this.config = {
      metricsRetentionHours: 24,
      aggregationIntervalMs: 60000, // 1 minute
      alertCheckIntervalMs: 30000, // 30 seconds
      maxMetricPoints: 1440, // 24 hours of minute data
      ...config
    };

    this.startTime = new Date();
    this.initializeMonitoring();
  }

  private initializeMonitoring(): void {
    // Start aggregation interval
    this.aggregationInterval = setInterval(
      () => this.aggregateMetrics(),
      this.config.aggregationIntervalMs
    );

    // Start alert checking interval
    this.alertInterval = setInterval(
      () => this.checkAlerts(),
      this.config.alertCheckIntervalMs
    );

    // Initialize system metrics
    this.initializeSystemMetrics();
  }

  private initializeSystemMetrics(): void {
    // Memory usage
    this.registerMetric({
      name: 'system.memory.heap_used',
      type: 'gauge',
      unit: 'bytes',
      description: 'Heap memory used by the Node.js process'
    });

    // CPU usage (approximation)
    this.registerMetric({
      name: 'system.cpu.usage',
      type: 'gauge',
      unit: 'percent',
      description: 'CPU usage percentage'
    });

    // Uptime
    this.registerMetric({
      name: 'system.uptime',
      type: 'counter',
      unit: 'seconds',
      description: 'Time since monitor started'
    });

    // Collect system metrics periodically
    setInterval(() => this.collectSystemMetrics(), 10000);
  }

  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.recordMetric('system.memory.heap_used', memUsage.heapUsed);
    
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    this.recordMetric('system.uptime', uptime);
  }

  public registerMetric(options: {
    name: string;
    type: 'counter' | 'gauge' | 'histogram' | 'rate';
    unit?: string;
    description?: string;
  }): void {
    if (this.metrics.has(options.name)) {
      this.logger.warn('MONITOR', `Metric ${options.name} already registered`);
      return;
    }

    const metric: Metric = {
      name: options.name,
      type: options.type,
      points: [],
      unit: options.unit,
      description: options.description
    };

    this.metrics.set(options.name, metric);
    this.logger.debug('MONITOR', `Registered metric: ${options.name}`);
  }

  public recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      this.logger.warn('MONITOR', `Metric ${name} not registered`);
      return;
    }

    const point: MetricPoint = {
      timestamp: new Date(),
      value,
      tags
    };

    metric.points.push(point);

    // Trim old points if necessary
    if (metric.points.length > this.config.maxMetricPoints) {
      metric.points.shift();
    }

    // Log high-level metrics
    if (name.includes('error') || name.includes('failure')) {
      this.logger.error('MONITOR', `Metric ${name}: ${value}`, { tags });
    }
  }

  public incrementCounter(name: string, increment: number = 1, tags?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      this.logger.warn('MONITOR', `Counter ${name} not found`);
      return;
    }

    const lastValue = metric.points.length > 0 
      ? metric.points[metric.points.length - 1].value 
      : 0;

    this.recordMetric(name, lastValue + increment, tags);
  }

  public recordDuration(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.recordMetric(name, durationMs, tags);
    
    // Also record to histogram if it exists
    const histogramName = `${name}.histogram`;
    if (this.metrics.has(histogramName)) {
      this.recordMetric(histogramName, durationMs, tags);
    }
  }

  public registerAlert(options: {
    name: string;
    metricName: string;
    condition: 'above' | 'below' | 'equals';
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): void {
    const alert: Alert = {
      id: `alert_${Date.now()}`,
      name: options.name,
      condition: `${options.metricName} ${options.condition} ${options.threshold}`,
      threshold: options.threshold,
      currentValue: 0,
      triggered: false,
      severity: options.severity
    };

    this.alerts.set(alert.id, alert);
    this.logger.info('MONITOR', `Registered alert: ${options.name}`);
  }

  private checkAlerts(): void {
    for (const [id, alert] of this.alerts) {
      const [metricName, condition, thresholdStr] = alert.condition.split(' ');
      const metric = this.metrics.get(metricName);
      
      if (!metric || metric.points.length === 0) {
        continue;
      }

      const currentValue = metric.points[metric.points.length - 1].value;
      alert.currentValue = currentValue;

      const threshold = parseFloat(thresholdStr);
      let shouldTrigger = false;

      switch (condition) {
        case 'above':
          shouldTrigger = currentValue > threshold;
          break;
        case 'below':
          shouldTrigger = currentValue < threshold;
          break;
        case 'equals':
          shouldTrigger = currentValue === threshold;
          break;
      }

      if (shouldTrigger && !alert.triggered) {
        alert.triggered = true;
        alert.triggeredAt = new Date();
        this.triggerAlert(alert);
      } else if (!shouldTrigger && alert.triggered) {
        alert.triggered = false;
        alert.resolvedAt = new Date();
        this.resolveAlert(alert);
      }
    }
  }

  private triggerAlert(alert: Alert): void {
    this.logger.error('ALERT', `Alert triggered: ${alert.name}`, {
      condition: alert.condition,
      currentValue: alert.currentValue,
      severity: alert.severity
    });

    this.emit('alert', alert);
  }

  private resolveAlert(alert: Alert): void {
    this.logger.info('ALERT', `Alert resolved: ${alert.name}`, {
      condition: alert.condition,
      currentValue: alert.currentValue,
      duration: alert.resolvedAt!.getTime() - alert.triggeredAt!.getTime()
    });

    this.emit('alert-resolved', alert);
  }

  private aggregateMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.config.metricsRetentionHours * 60 * 60 * 1000);

    for (const metric of this.metrics.values()) {
      // Remove old points
      metric.points = metric.points.filter(p => p.timestamp > cutoffTime);
    }
  }

  public getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  public getMetricSummary(name: string, windowMinutes: number = 60): {
    min: number;
    max: number;
    avg: number;
    current: number;
    count: number;
  } | null {
    const metric = this.metrics.get(name);
    if (!metric || metric.points.length === 0) {
      return null;
    }

    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentPoints = metric.points.filter(p => p.timestamp > cutoff);

    if (recentPoints.length === 0) {
      return null;
    }

    const values = recentPoints.map(p => p.value);
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      current: values[values.length - 1],
      count: values.length
    };
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.triggered);
  }

  public getMetricsReport(): Record<string, any> {
    const report: Record<string, any> = {
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      metrics: {},
      alerts: {
        active: this.getActiveAlerts().length,
        total: this.alerts.size
      }
    };

    for (const [name, metric] of this.metrics) {
      const summary = this.getMetricSummary(name, 60);
      if (summary) {
        report.metrics[name] = {
          ...summary,
          type: metric.type,
          unit: metric.unit
        };
      }
    }

    return report;
  }

  public recordBusinessMetrics(metrics: {
    revenue?: number;
    spend?: number;
    roas?: number;
    activeCampaigns?: number;
    activeProducts?: number;
    netWorth?: number;
    errorCount?: number;
  }): void {
    if (metrics.revenue !== undefined) {
      this.recordMetric('business.revenue', metrics.revenue);
    }
    if (metrics.spend !== undefined) {
      this.recordMetric('business.spend', metrics.spend);
    }
    if (metrics.roas !== undefined) {
      this.recordMetric('business.roas', metrics.roas);
    }
    if (metrics.activeCampaigns !== undefined) {
      this.recordMetric('business.campaigns.active', metrics.activeCampaigns);
    }
    if (metrics.activeProducts !== undefined) {
      this.recordMetric('business.products.active', metrics.activeProducts);
    }
    if (metrics.netWorth !== undefined) {
      this.recordMetric('business.net_worth', metrics.netWorth);
    }
    if (metrics.errorCount !== undefined) {
      this.recordMetric('system.errors.count', metrics.errorCount);
    }
  }

  public startOperation(name: string, tags?: Record<string, string>): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      this.recordDuration(`operation.${name}.duration`, duration, tags);
      this.incrementCounter(`operation.${name}.count`, 1, tags);
    };
  }

  public close(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
    }
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
    }

    this.removeAllListeners();
  }
}