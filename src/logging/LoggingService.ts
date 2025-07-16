import { Logger, LogLevel } from './Logger.js';
import { Monitor } from './Monitor.js';
import { AuditTrail } from './AuditTrail.js';

export interface LoggingServiceConfig {
  logLevel?: LogLevel;
  logDir?: string;
  auditDir?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableMonitoring?: boolean;
  enableAudit?: boolean;
}

export class LoggingService {
  private static instance: LoggingService | null = null;
  
  public readonly logger: Logger;
  public readonly monitor: Monitor;
  public readonly audit: AuditTrail;
  
  private constructor(config: LoggingServiceConfig = {}) {
    // Initialize logger
    this.logger = new Logger({
      level: config.logLevel || LogLevel.INFO,
      outputDir: config.logDir,
      consoleOutput: config.enableConsole !== false,
      fileOutput: config.enableFile !== false,
      structuredLogging: true
    });

    // Initialize monitor
    this.monitor = new Monitor(this.logger);
    this.initializeBusinessMetrics();
    this.initializeAlerts();

    // Initialize audit trail
    this.audit = new AuditTrail(this.logger, config.auditDir);

    // Log service initialization
    this.logger.info('LOGGING_SERVICE', 'Logging service initialized', {
      logLevel: LogLevel[config.logLevel || LogLevel.INFO],
      monitoring: config.enableMonitoring !== false,
      audit: config.enableAudit !== false
    });
  }

  private initializeBusinessMetrics(): void {
    // Financial metrics
    this.monitor.registerMetric({
      name: 'business.revenue',
      type: 'counter',
      unit: 'USD',
      description: 'Total revenue generated'
    });

    this.monitor.registerMetric({
      name: 'business.spend',
      type: 'counter',
      unit: 'USD',
      description: 'Total advertising spend'
    });

    this.monitor.registerMetric({
      name: 'business.net_worth',
      type: 'gauge',
      unit: 'USD',
      description: 'Current net worth'
    });

    this.monitor.registerMetric({
      name: 'business.roas',
      type: 'gauge',
      unit: 'ratio',
      description: 'Return on ad spend'
    });

    // Campaign metrics
    this.monitor.registerMetric({
      name: 'business.campaigns.active',
      type: 'gauge',
      unit: 'count',
      description: 'Number of active campaigns'
    });

    this.monitor.registerMetric({
      name: 'business.campaigns.created',
      type: 'counter',
      unit: 'count',
      description: 'Total campaigns created'
    });

    this.monitor.registerMetric({
      name: 'business.campaigns.killed',
      type: 'counter',
      unit: 'count',
      description: 'Total campaigns killed'
    });

    // Product metrics
    this.monitor.registerMetric({
      name: 'business.products.active',
      type: 'gauge',
      unit: 'count',
      description: 'Number of active products'
    });

    this.monitor.registerMetric({
      name: 'business.products.researched',
      type: 'counter',
      unit: 'count',
      description: 'Total products researched'
    });

    // Decision metrics
    this.monitor.registerMetric({
      name: 'decisions.total',
      type: 'counter',
      unit: 'count',
      description: 'Total decisions made'
    });

    this.monitor.registerMetric({
      name: 'decisions.confidence',
      type: 'histogram',
      unit: 'percent',
      description: 'Decision confidence distribution'
    });

    // Error metrics
    this.monitor.registerMetric({
      name: 'errors.total',
      type: 'counter',
      unit: 'count',
      description: 'Total errors encountered'
    });

    this.monitor.registerMetric({
      name: 'errors.rate',
      type: 'rate',
      unit: 'per_minute',
      description: 'Error rate'
    });

    // API metrics
    this.monitor.registerMetric({
      name: 'api.requests',
      type: 'counter',
      unit: 'count',
      description: 'Total API requests'
    });

    this.monitor.registerMetric({
      name: 'api.latency',
      type: 'histogram',
      unit: 'ms',
      description: 'API request latency'
    });
  }

  private initializeAlerts(): void {
    // Financial alerts
    this.monitor.registerAlert({
      name: 'Low Balance Alert',
      metricName: 'business.net_worth',
      condition: 'below',
      threshold: 100,
      severity: 'high'
    });

    this.monitor.registerAlert({
      name: 'Negative ROAS Alert',
      metricName: 'business.roas',
      condition: 'below',
      threshold: 1.0,
      severity: 'critical'
    });

    // Error rate alerts
    this.monitor.registerAlert({
      name: 'High Error Rate',
      metricName: 'errors.rate',
      condition: 'above',
      threshold: 10,
      severity: 'high'
    });

    // Campaign alerts
    this.monitor.registerAlert({
      name: 'No Active Campaigns',
      metricName: 'business.campaigns.active',
      condition: 'equals',
      threshold: 0,
      severity: 'medium'
    });

    // Set up alert handlers
    this.monitor.on('alert', (alert) => {
      this.logger.critical('ALERT', `Alert triggered: ${alert.name}`, {
        condition: alert.condition,
        currentValue: alert.currentValue,
        severity: alert.severity
      });

      // Audit the alert
      this.audit.auditSystemEvent('ALERT_TRIGGERED', {
        alertId: alert.id,
        alertName: alert.name,
        severity: alert.severity,
        condition: alert.condition,
        currentValue: alert.currentValue
      });
    });

    this.monitor.on('alert-resolved', (alert) => {
      this.logger.info('ALERT', `Alert resolved: ${alert.name}`, {
        duration: alert.resolvedAt!.getTime() - alert.triggeredAt!.getTime()
      });

      this.audit.auditSystemEvent('ALERT_RESOLVED', {
        alertId: alert.id,
        alertName: alert.name,
        duration: alert.resolvedAt!.getTime() - alert.triggeredAt!.getTime()
      });
    });
  }

  // Singleton instance
  public static getInstance(config?: LoggingServiceConfig): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService(config);
    }
    return LoggingService.instance;
  }

  // Helper methods for common logging patterns
  public logDecision(decision: {
    id: string;
    type: string;
    action: string;
    reasoning: string;
    confidence: number;
    context?: any;
  }): void {
    // Log the decision
    this.logger.logDecision({
      action: decision.action,
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      context: decision.context
    });

    // Update metrics
    this.monitor.incrementCounter('decisions.total');
    this.monitor.recordMetric('decisions.confidence', decision.confidence);

    // Audit the decision
    this.audit.auditDecision({
      decisionId: decision.id,
      type: decision.type,
      reasoning: decision.reasoning,
      confidence: decision.confidence
    });
  }

  public logFinancialTransaction(transaction: {
    id: string;
    type: 'revenue' | 'expense' | 'fee' | 'adjustment';
    amount: number;
    description: string;
    campaignId?: string;
    productId?: string;
    balanceBefore: number;
    balanceAfter: number;
  }): void {
    // Log the transaction
    this.logger.logFinancialTransaction({
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      campaignId: transaction.campaignId,
      productId: transaction.productId
    });

    // Update metrics
    if (transaction.type === 'revenue') {
      this.monitor.incrementCounter('business.revenue', transaction.amount);
    } else if (transaction.type === 'expense' || transaction.type === 'fee') {
      this.monitor.incrementCounter('business.spend', transaction.amount);
    }
    this.monitor.recordMetric('business.net_worth', transaction.balanceAfter);

    // Audit the transaction
    this.audit.auditFinancialTransaction({
      transactionId: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      currency: 'USD',
      description: transaction.description,
      campaignId: transaction.campaignId,
      productId: transaction.productId,
      balance: {
        before: transaction.balanceBefore,
        after: transaction.balanceAfter
      }
    });
  }

  public logCampaignAction(action: string, campaign: {
    id: string;
    platform: string;
    product: string;
    angle?: string;
    budget?: number;
    roas?: number;
  }): void {
    // Log the action
    this.logger.info('CAMPAIGN', `${action}: ${campaign.id}`, {
      platform: campaign.platform,
      product: campaign.product,
      angle: campaign.angle,
      budget: campaign.budget,
      roas: campaign.roas
    });

    // Update metrics
    if (action === 'CREATE') {
      this.monitor.incrementCounter('business.campaigns.created');
    } else if (action === 'KILL') {
      this.monitor.incrementCounter('business.campaigns.killed');
    }

    // Audit the action
    this.audit.auditCampaignAction(action, campaign.id, {
      platform: campaign.platform,
      product: campaign.product,
      angle: campaign.angle,
      budget: campaign.budget,
      roas: campaign.roas
    });
  }

  public logError(error: Error, context?: any): void {
    // Log the error
    this.logger.error('ERROR', error.message, {
      stack: error.stack,
      context
    });

    // Update metrics
    this.monitor.incrementCounter('errors.total');
    this.monitor.recordMetric('errors.rate', 1);

    // Audit critical errors
    if (context?.critical) {
      this.audit.auditSystemEvent('CRITICAL_ERROR', {
        error: error.message,
        stack: error.stack,
        context
      });
    }
  }

  public startOperation(name: string, metadata?: any): () => void {
    const endTimer = this.logger.startTimer(name);
    const endMonitor = this.monitor.startOperation(name, metadata);

    return () => {
      endTimer();
      endMonitor();
    };
  }

  // Get service status
  public getStatus(): {
    logger: any;
    monitor: any;
    audit: any;
    alerts: any[];
  } {
    return {
      logger: this.logger.getStats(),
      monitor: this.monitor.getMetricsReport(),
      audit: {
        initialized: true,
        // Add more audit stats as needed
      },
      alerts: this.monitor.getActiveAlerts()
    };
  }

  // Cleanup
  public close(): void {
    this.logger.info('LOGGING_SERVICE', 'Shutting down logging service');
    
    this.logger.close();
    this.monitor.close();
    this.audit.close();
    
    LoggingService.instance = null;
  }
}