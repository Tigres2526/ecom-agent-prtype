import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Logger, LogLevel } from './Logger.js';

describe('Logger', () => {
  let logger: Logger;
  const testLogDir = path.join(process.cwd(), 'test-logs');

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (logger) {
      logger.close();
    }
    // Clean up test directory
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create log directory if it does not exist', () => {
      logger = new Logger({
        outputDir: testLogDir,
        fileOutput: true,
        consoleOutput: false
      });

      expect(fs.existsSync(testLogDir)).toBe(true);
    });

    it('should use default configuration when no config provided', () => {
      logger = new Logger({
        consoleOutput: false,
        fileOutput: false
      });

      expect(logger).toBeDefined();
    });
  });

  describe('log levels', () => {
    it('should respect log level filtering', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      logger = new Logger({
        level: LogLevel.WARN,
        consoleOutput: true,
        fileOutput: false
      });

      logger.debug('TEST', 'Debug message');
      logger.info('TEST', 'Info message');
      logger.warn('TEST', 'Warning message');
      logger.error('TEST', 'Error message');

      // Should not log debug or info
      expect(consoleSpy).toHaveBeenCalledTimes(0);
      // Should log warn and error
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should log all levels when set to DEBUG', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      logger = new Logger({
        level: LogLevel.DEBUG,
        consoleOutput: true,
        fileOutput: false
      });

      logger.debug('TEST', 'Debug message');
      logger.info('TEST', 'Info message');
      logger.warn('TEST', 'Warning message');
      logger.error('TEST', 'Error message');

      const totalCalls = consoleSpy.mock.calls.length + 
                        warnSpy.mock.calls.length + 
                        errorSpy.mock.calls.length;
      
      expect(totalCalls).toBe(4);
      
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('file output', () => {
    it('should write logs to file', async () => {
      logger = new Logger({
        outputDir: testLogDir,
        fileOutput: true,
        consoleOutput: false,
        structuredLogging: true
      });

      logger.info('TEST', 'Test message', { data: 'test' });
      
      // Force flush and wait
      await logger.closeAndWait();

      const files = fs.readdirSync(testLogDir);
      expect(files.length).toBeGreaterThan(0);
      
      const logFile = files.find(f => f.startsWith('agent-'));
      expect(logFile).toBeDefined();

      const content = fs.readFileSync(path.join(testLogDir, logFile!), 'utf-8');
      const logEntry = JSON.parse(content.trim());
      
      expect(logEntry.level).toBe('INFO');
      expect(logEntry.category).toBe('TEST');
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.data).toEqual({ data: 'test' });
    });

    it('should rotate log files when size limit reached', async () => {
      logger = new Logger({
        outputDir: testLogDir,
        fileOutput: true,
        consoleOutput: false,
        maxFileSize: 100, // Very small for testing
        structuredLogging: false
      });

      // Write enough data to trigger rotation
      for (let i = 0; i < 10; i++) {
        logger.info('TEST', 'A'.repeat(50));
      }

      await logger.closeAndWait();

      const files = fs.readdirSync(testLogDir);
      expect(files.length).toBeGreaterThan(1);
    });
  });

  describe('structured logging', () => {
    it('should format logs as JSON when structured logging enabled', async () => {
      logger = new Logger({
        outputDir: testLogDir,
        fileOutput: true,
        consoleOutput: false,
        structuredLogging: true
      });

      logger.info('TEST', 'Test message', { key: 'value' });
      await logger.closeAndWait();

      const files = fs.readdirSync(testLogDir);
      const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf-8');
      
      expect(() => JSON.parse(content.trim())).not.toThrow();
    });

    it('should format logs as plain text when structured logging disabled', async () => {
      logger = new Logger({
        outputDir: testLogDir,
        fileOutput: true,
        consoleOutput: false,
        structuredLogging: false
      });

      logger.info('TEST', 'Test message');
      await logger.closeAndWait();

      const files = fs.readdirSync(testLogDir);
      const content = fs.readFileSync(path.join(testLogDir, files[0]), 'utf-8');
      
      expect(content).toContain('INFO');
      expect(content).toContain('TEST');
      expect(content).toContain('Test message');
    });
  });

  describe('specialized logging methods', () => {
    it('should log decisions with proper structure', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger = new Logger({
        consoleOutput: true,
        fileOutput: false
      });

      logger.logDecision({
        action: 'CREATE_CAMPAIGN',
        reasoning: 'High potential product',
        confidence: 0.85,
        outcome: 'Success'
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('DECISION');
      expect(logCall).toContain('CREATE_CAMPAIGN');
      
      consoleSpy.mockRestore();
    });

    it('should log financial transactions', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger = new Logger({
        consoleOutput: true,
        fileOutput: false
      });

      logger.logFinancialTransaction({
        type: 'revenue',
        amount: 100.50,
        description: 'Sale',
        campaignId: 'camp123'
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('FINANCIAL');
      expect(logCall).toContain('revenue: $100.50');
      
      consoleSpy.mockRestore();
    });

    it('should log performance metrics', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger = new Logger({
        consoleOutput: true,
        fileOutput: false
      });

      logger.logPerformanceMetric({
        name: 'ROAS',
        value: 2.5,
        unit: 'x'
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('PERFORMANCE');
      expect(logCall).toContain('ROAS: 2.5x');
      
      consoleSpy.mockRestore();
    });
  });

  describe('timer functionality', () => {
    it('should measure operation duration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      logger = new Logger({
        level: LogLevel.DEBUG,
        consoleOutput: true,
        fileOutput: false
      });

      const endTimer = logger.startTimer('test-operation');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      endTimer();

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('TIMING');
      expect(logCall).toContain('test-operation completed');
      
      consoleSpy.mockRestore();
    });
  });

  describe('log search', () => {
    it('should search logs by criteria', async () => {
      logger = new Logger({
        outputDir: testLogDir,
        fileOutput: true,
        consoleOutput: false,
        structuredLogging: true
      });

      logger.info('CAT1', 'Message 1');
      logger.warn('CAT2', 'Message 2');
      logger.error('CAT1', 'Message 3');
      
      await logger.closeAndWait();

      const results = await logger.searchLogs({
        category: 'CAT1'
      });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.category === 'CAT1')).toBe(true);
    });

    it('should filter by log level in search', async () => {
      logger = new Logger({
        outputDir: testLogDir,
        fileOutput: true,
        consoleOutput: false,
        structuredLogging: true
      });

      logger.info('TEST', 'Info message');
      logger.warn('TEST', 'Warning message');
      logger.error('TEST', 'Error message');
      
      await logger.closeAndWait();

      const results = await logger.searchLogs({
        level: LogLevel.WARN
      });

      expect(results).toHaveLength(2); // WARN and ERROR
    });
  });

  describe('cleanup', () => {
    it('should clean up old log files', () => {
      logger = new Logger({
        outputDir: testLogDir,
        fileOutput: true,
        consoleOutput: false,
        maxFiles: 3
      });

      // Create some old log files
      for (let i = 0; i < 5; i++) {
        const filename = `agent-2023-01-0${i + 1}.log`;
        fs.writeFileSync(path.join(testLogDir, filename), 'test');
      }

      // Trigger cleanup by rotating
      logger['cleanupOldLogs']();

      const files = fs.readdirSync(testLogDir);
      expect(files.length).toBeLessThanOrEqual(3);
    });
  });
});