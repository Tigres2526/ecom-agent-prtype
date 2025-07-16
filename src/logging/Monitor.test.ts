import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Monitor } from './Monitor.js';
import { Logger, LogLevel } from './Logger.js';

describe('Monitor', () => {
  let monitor: Monitor;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ consoleOutput: false, fileOutput: false });
    monitor = new Monitor(logger, {
      aggregationIntervalMs: 100,
      alertCheckIntervalMs: 100
    });
  });

  afterEach(() => {
    monitor.close();
    logger.close();
  });

  describe('metric registration', () => {
    it('should register metrics with different types', () => {
      monitor.registerMetric({
        name: 'test.counter',
        type: 'counter',
        unit: 'count'
      });

      monitor.registerMetric({
        name: 'test.gauge',
        type: 'gauge',
        unit: 'value'
      });

      const counter = monitor.getMetric('test.counter');
      const gauge = monitor.getMetric('test.gauge');

      expect(counter).toBeDefined();
      expect(counter?.type).toBe('counter');
      expect(gauge).toBeDefined();
      expect(gauge?.type).toBe('gauge');
    });

    it('should warn when registering duplicate metric', () => {
      const warnSpy = vi.spyOn(logger, 'warn');

      monitor.registerMetric({
        name: 'test.metric',
        type: 'counter'
      });

      monitor.registerMetric({
        name: 'test.metric',
        type: 'gauge'
      });

      expect(warnSpy).toHaveBeenCalledWith(
        'MONITOR',
        'Metric test.metric already registered'
      );
    });
  });

  describe('metric recording', () => {
    it('should record metric values', () => {
      monitor.registerMetric({
        name: 'test.metric',
        type: 'gauge'
      });

      monitor.recordMetric('test.metric', 100);
      monitor.recordMetric('test.metric', 200);

      const metric = monitor.getMetric('test.metric');
      expect(metric?.points).toHaveLength(2);
      expect(metric?.points[0].value).toBe(100);
      expect(metric?.points[1].value).toBe(200);
    });

    it('should record metrics with tags', () => {
      monitor.registerMetric({
        name: 'test.metric',
        type: 'gauge'
      });

      monitor.recordMetric('test.metric', 100, { env: 'test' });

      const metric = monitor.getMetric('test.metric');
      expect(metric?.points[0].tags).toEqual({ env: 'test' });
    });

    it('should warn when recording to non-existent metric', () => {
      const warnSpy = vi.spyOn(logger, 'warn');

      monitor.recordMetric('non.existent', 100);

      expect(warnSpy).toHaveBeenCalledWith(
        'MONITOR',
        'Metric non.existent not registered'
      );
    });
  });

  describe('counter operations', () => {
    it('should increment counter values', () => {
      monitor.registerMetric({
        name: 'test.counter',
        type: 'counter'
      });

      monitor.incrementCounter('test.counter', 5);
      monitor.incrementCounter('test.counter', 3);

      const metric = monitor.getMetric('test.counter');
      expect(metric?.points[0].value).toBe(5);
      expect(metric?.points[1].value).toBe(8);
    });

    it('should default to increment of 1', () => {
      monitor.registerMetric({
        name: 'test.counter',
        type: 'counter'
      });

      monitor.incrementCounter('test.counter');
      monitor.incrementCounter('test.counter');

      const metric = monitor.getMetric('test.counter');
      expect(metric?.points[1].value).toBe(2);
    });
  });

  describe('duration recording', () => {
    it('should record duration metrics', () => {
      monitor.registerMetric({
        name: 'test.duration',
        type: 'histogram'
      });

      monitor.recordDuration('test.duration', 150);

      const metric = monitor.getMetric('test.duration');
      expect(metric?.points[0].value).toBe(150);
    });
  });

  describe('alerts', () => {
    it('should register and trigger alerts', async () => {
      const alertSpy = vi.fn();
      monitor.on('alert', alertSpy);

      monitor.registerMetric({
        name: 'test.value',
        type: 'gauge'
      });

      monitor.registerAlert({
        name: 'High Value Alert',
        metricName: 'test.value',
        condition: 'above',
        threshold: 100,
        severity: 'high'
      });

      // Record value below threshold
      monitor.recordMetric('test.value', 50);
      
      // Wait for alert check
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(alertSpy).not.toHaveBeenCalled();

      // Record value above threshold
      monitor.recordMetric('test.value', 150);
      
      // Wait for alert check
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(alertSpy).toHaveBeenCalled();
    });

    it('should resolve alerts when condition no longer met', async () => {
      const alertResolvedSpy = vi.fn();
      monitor.on('alert-resolved', alertResolvedSpy);

      monitor.registerMetric({
        name: 'test.value',
        type: 'gauge'
      });

      monitor.registerAlert({
        name: 'Low Value Alert',
        metricName: 'test.value',
        condition: 'below',
        threshold: 50,
        severity: 'medium'
      });

      // Trigger alert
      monitor.recordMetric('test.value', 30);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Resolve alert
      monitor.recordMetric('test.value', 70);
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(alertResolvedSpy).toHaveBeenCalled();
    });
  });

  describe('metric summaries', () => {
    it('should calculate metric summary statistics', () => {
      monitor.registerMetric({
        name: 'test.values',
        type: 'gauge'
      });

      monitor.recordMetric('test.values', 10);
      monitor.recordMetric('test.values', 20);
      monitor.recordMetric('test.values', 30);
      monitor.recordMetric('test.values', 40);

      const summary = monitor.getMetricSummary('test.values');

      expect(summary).toEqual({
        min: 10,
        max: 40,
        avg: 25,
        current: 40,
        count: 4
      });
    });

    it('should return null for non-existent metrics', () => {
      const summary = monitor.getMetricSummary('non.existent');
      expect(summary).toBeNull();
    });

    it('should respect time window for summaries', async () => {
      monitor.registerMetric({
        name: 'test.timed',
        type: 'gauge'
      });

      monitor.recordMetric('test.timed', 10);
      
      // Wait and add more recent values
      await new Promise(resolve => setTimeout(resolve, 100));
      monitor.recordMetric('test.timed', 20);
      monitor.recordMetric('test.timed', 30);

      // Get summary for very small window
      const summary = monitor.getMetricSummary('test.timed', 0.001);
      
      expect(summary?.count).toBeLessThan(3);
    });
  });

  describe('business metrics', () => {
    it('should record business metrics', () => {
      // Register business metrics first
      monitor.registerMetric({ name: 'business.revenue', type: 'gauge' });
      monitor.registerMetric({ name: 'business.spend', type: 'gauge' });
      monitor.registerMetric({ name: 'business.roas', type: 'gauge' });

      monitor.recordBusinessMetrics({
        revenue: 1000,
        spend: 500,
        roas: 2.0
      });

      expect(monitor.getMetric('business.revenue')?.points[0].value).toBe(1000);
      expect(monitor.getMetric('business.spend')?.points[0].value).toBe(500);
      expect(monitor.getMetric('business.roas')?.points[0].value).toBe(2.0);
    });
  });

  describe('operation timing', () => {
    it('should time operations', async () => {
      monitor.registerMetric({
        name: 'operation.test-op.duration',
        type: 'histogram'
      });
      monitor.registerMetric({
        name: 'operation.test-op.count',
        type: 'counter'
      });

      const endTimer = monitor.startOperation('test-op');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      endTimer();

      const durationMetric = monitor.getMetric('operation.test-op.duration');
      const countMetric = monitor.getMetric('operation.test-op.count');

      expect(durationMetric?.points[0].value).toBeGreaterThan(40);
      expect(countMetric?.points[0].value).toBe(1);
    });
  });

  describe('metrics report', () => {
    it('should generate comprehensive metrics report', () => {
      monitor.registerMetric({ name: 'test.metric1', type: 'gauge' });
      monitor.registerMetric({ name: 'test.metric2', type: 'counter' });

      monitor.recordMetric('test.metric1', 100);
      monitor.recordMetric('test.metric2', 5);

      const report = monitor.getMetricsReport();

      expect(report.uptime).toBeGreaterThanOrEqual(0);
      expect(report.metrics['test.metric1']).toBeDefined();
      expect(report.metrics['test.metric2']).toBeDefined();
      expect(report.alerts.total).toBe(0);
    });
  });

  describe('active alerts', () => {
    it('should return list of active alerts', async () => {
      monitor.registerMetric({ name: 'test.alert.metric', type: 'gauge' });

      monitor.registerAlert({
        name: 'Test Alert',
        metricName: 'test.alert.metric',
        condition: 'above',
        threshold: 50,
        severity: 'low'
      });

      monitor.recordMetric('test.alert.metric', 60);
      
      await new Promise(resolve => setTimeout(resolve, 150));

      const activeAlerts = monitor.getActiveAlerts();
      expect(activeAlerts).toHaveLength(1);
      expect(activeAlerts[0].name).toBe('Test Alert');
    });
  });

  describe('system metrics', () => {
    it('should collect system metrics automatically', async () => {
      // Wait for system metrics collection
      await new Promise(resolve => setTimeout(resolve, 150));

      const heapMetric = monitor.getMetric('system.memory.heap_used');
      const uptimeMetric = monitor.getMetric('system.uptime');

      expect(heapMetric?.points.length).toBeGreaterThan(0);
      expect(uptimeMetric?.points.length).toBeGreaterThan(0);
    });
  });
});