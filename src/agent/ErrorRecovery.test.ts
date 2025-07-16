import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorRecovery, CircuitBreaker } from './ErrorRecovery.js';
import { AgentState } from '../models/AgentState.js';
import { Campaign } from '../models/Campaign.js';
import { Product } from '../models/Product.js';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(3, 1000, 5000); // 3 failures, 1s timeout, 5s reset
  });

  describe('basic functionality', () => {
    it('should allow calls when circuit is closed', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.call(mockFn, 'test operation');
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledOnce();
    });

    it('should track failures and open circuit after threshold', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      
      // First 2 failures should still allow calls
      await expect(circuitBreaker.call(mockFn, 'test')).rejects.toThrow('Test error');
      await expect(circuitBreaker.call(mockFn, 'test')).rejects.toThrow('Test error');
      
      expect(circuitBreaker.getStatus().state).toBe('closed');
      
      // 3rd failure should open the circuit
      await expect(circuitBreaker.call(mockFn, 'test')).rejects.toThrow('Test error');
      
      expect(circuitBreaker.getStatus().state).toBe('open');
      expect(circuitBreaker.isOpen()).toBe(true);
    });

    it('should block calls when circuit is open', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      
      // Trigger circuit to open
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.call(mockFn, 'test')).rejects.toThrow();
      }
      
      expect(circuitBreaker.isOpen()).toBe(true);
      
      // Next call should be blocked
      await expect(circuitBreaker.call(mockFn, 'test')).rejects.toThrow('Circuit breaker is open');
    });

    it('should transition to half-open after reset timeout', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.call(mockFn, 'test')).rejects.toThrow();
      }
      
      expect(circuitBreaker.getStatus().state).toBe('open');
      
      // Wait for reset timeout (using a shorter timeout for testing)
      const shortCircuit = new CircuitBreaker(3, 1000, 100);
      for (let i = 0; i < 3; i++) {
        await expect(shortCircuit.call(mockFn, 'test')).rejects.toThrow();
      }
      
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Next call should transition to half-open
      mockFn.mockResolvedValueOnce('success');
      const result = await shortCircuit.call(mockFn, 'test');
      
      expect(result).toBe('success');
      expect(shortCircuit.getStatus().state).toBe('closed');
    });

    it('should handle timeout errors', async () => {
      const slowFn = () => new Promise(resolve => setTimeout(resolve, 2000));
      
      await expect(circuitBreaker.call(slowFn, 'slow operation')).rejects.toThrow('Operation timeout');
    });

    it('should reset manually', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.call(mockFn, 'test')).rejects.toThrow();
      }
      
      expect(circuitBreaker.isOpen()).toBe(true);
      
      circuitBreaker.reset();
      
      expect(circuitBreaker.getStatus().state).toBe('closed');
      expect(circuitBreaker.getStatus().failures).toBe(0);
    });
  });

  describe('status reporting', () => {
    it('should provide comprehensive status', async () => {
      const status = circuitBreaker.getStatus();
      
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failures');
      expect(status).toHaveProperty('threshold');
      expect(status).toHaveProperty('lastFailureTime');
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
      expect(status.threshold).toBe(3);
    });

    it('should include time until reset when open', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.call(mockFn, 'test')).rejects.toThrow();
      }
      
      const status = circuitBreaker.getStatus();
      expect(status.state).toBe('open');
      expect(status).toHaveProperty('timeUntilReset');
      expect(status.timeUntilReset).toBeGreaterThan(0);
    });
  });
});

describe('ErrorRecovery', () => {
  let errorRecovery: ErrorRecovery;
  let agentState: AgentState;

  beforeEach(() => {
    errorRecovery = new ErrorRecovery(100);
    agentState = new AgentState(1000, 50, 10);
    
    // Add some test data
    const product = new Product({
      name: 'Test Product',
      sourceUrl: 'https://example.com',
      supplierPrice: 10,
      recommendedPrice: 30,
      margin: 20,
      contentScore: 75,
      competitorCount: 15,
      status: 'testing',
      createdDay: 1,
    });
    
    const campaign = new Campaign({
      productId: product.id,
      platform: 'facebook',
      angle: 'Test angle',
      budget: 100,
      spend: 50,
      revenue: 60,
      roas: 1.2,
      status: 'active',
      createdDay: 1,
      lastOptimized: 1,
    });
    
    agentState.addProduct(product);
    agentState.addCampaign(campaign);
  });

  describe('error categorization', () => {
    it('should categorize API errors correctly', async () => {
      const apiError = new Error('API timeout occurred');
      const context = {
        type: 'api' as const,
        message: 'API call failed',
        context: { endpoint: '/products' },
        timestamp: new Date(),
        day: 1
      };
      
      const actions = await errorRecovery.recoverFromError(apiError, context, agentState);
      
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(a => a.description.includes('retry'))).toBe(true);
    });

    it('should categorize financial errors correctly', async () => {
      const financialError = new Error('Insufficient budget for campaign');
      const context = {
        type: 'financial' as const,
        message: 'Budget exceeded',
        context: { campaignId: '123' },
        timestamp: new Date(),
        day: 1
      };
      
      const actions = await errorRecovery.recoverFromError(financialError, context, agentState);
      
      expect(actions.some(a => a.description.includes('budget'))).toBe(true);
    });

    it('should categorize product errors correctly', async () => {
      const productError = new Error('Product not found in supplier inventory');
      const context = {
        type: 'product' as const,
        message: 'Product error',
        context: { productId: '456' },
        timestamp: new Date(),
        day: 1
      };
      
      const actions = await errorRecovery.recoverFromError(productError, context, agentState);
      
      expect(actions.some(a => a.description.includes('product'))).toBe(true);
    });
  });

  describe('severity assessment', () => {
    it('should assess critical severity for bankruptcy', async () => {
      // Force bankruptcy
      const bankruptState = new AgentState(100, 50, 2);
      bankruptState.advanceDay();
      bankruptState.advanceDay();
      bankruptState.advanceDay();
      
      const error = new Error('System error');
      const context = {
        type: 'system' as const,
        message: 'System error',
        context: {},
        timestamp: new Date(),
        day: 3
      };
      
      const actions = await errorRecovery.recoverFromError(error, context, bankruptState);
      
      expect(actions.some(a => a.type === 'abort')).toBe(true);
    });

    it('should assess high severity for excessive errors', async () => {
      // Simulate excessive errors
      for (let i = 0; i < 12; i++) {
        agentState.incrementErrorCount();
      }
      
      const error = new Error('Another error');
      const context = {
        type: 'system' as const,
        message: 'System error',
        context: {},
        timestamp: new Date(),
        day: 1
      };
      
      const actions = await errorRecovery.recoverFromError(error, context, agentState);
      
      expect(actions.some(a => a.type === 'conservative')).toBe(true);
    });

    it('should assess medium severity for warning financial health', async () => {
      // Reduce net worth to warning level
      agentState.updateFinancials(0, 600); // Net worth becomes 400 (warning level)
      
      const error = new Error('Medium error');
      const context = {
        type: 'system' as const,
        message: 'System error',
        context: {},
        timestamp: new Date(),
        day: 1
      };
      
      const actions = await errorRecovery.recoverFromError(error, context, agentState);
      
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe('recovery mode', () => {
    it('should enter recovery mode on critical errors', async () => {
      const criticalError = new Error('Critical system failure');
      const context = {
        type: 'system' as const,
        message: 'Critical error',
        context: {},
        timestamp: new Date(),
        day: 1
      };
      
      // Force critical severity by making agent bankrupt
      const bankruptState = new AgentState(50, 100, 2);
      bankruptState.advanceDay();
      
      await errorRecovery.recoverFromError(criticalError, context, bankruptState);
      
      const status = errorRecovery.getRecoveryStatus();
      expect(status.recoveryMode).toBe(true);
      expect(status.recoveryDuration).toBeGreaterThan(0);
    });

    it('should exit recovery mode when conditions improve', async () => {
      // First enter recovery mode
      const criticalError = new Error('Critical error');
      const context = {
        type: 'system' as const,
        message: 'Critical error',
        context: {},
        timestamp: new Date(),
        day: 1
      };
      
      // Simulate excessive errors to trigger recovery mode
      for (let i = 0; i < 15; i++) {
        await errorRecovery.recoverFromError(
          new Error(`Error ${i}`),
          { ...context, timestamp: new Date() },
          agentState
        );
      }
      
      expect(errorRecovery.getRecoveryStatus().recoveryMode).toBe(true);
      
      // Clear errors and wait
      errorRecovery.clearErrorHistory();
      agentState.resetErrorCount();
      
      // Try to exit recovery mode
      const canExit = await errorRecovery.exitRecoveryMode(agentState);
      
      // Should not exit immediately due to minimum recovery time
      expect(canExit).toBe(false);
    });

    it('should implement conservative strategy in recovery mode', async () => {
      const initialCampaignCount = agentState.activeCampaigns.length;
      const initialProductCount = agentState.activeProducts.length;
      
      // Force recovery mode
      for (let i = 0; i < 12; i++) {
        await errorRecovery.recoverFromError(
          new Error(`Error ${i}`),
          {
            type: 'system',
            message: 'System error',
            context: {},
            timestamp: new Date(),
            day: 1
          },
          agentState
        );
      }
      
      // Check that conservative measures were applied
      const killedCampaigns = agentState.activeCampaigns.filter(c => c.status === 'killed');
      const killedProducts = agentState.activeProducts.filter(p => p.status === 'killed');
      
      expect(killedCampaigns.length + killedProducts.length).toBeGreaterThan(0);
    });
  });

  describe('circuit breaker integration', () => {
    it('should execute operations with circuit breaker protection', async () => {
      const successFn = vi.fn().mockResolvedValue('success');
      
      const result = await errorRecovery.executeWithCircuitBreaker(
        successFn,
        'test_operation',
        'test context'
      );
      
      expect(result).toBe('success');
      expect(successFn).toHaveBeenCalledOnce();
    });

    it('should handle circuit breaker failures', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Trigger circuit breaker to open
      for (let i = 0; i < 5; i++) {
        await expect(
          errorRecovery.executeWithCircuitBreaker(failFn, 'failing_operation')
        ).rejects.toThrow();
      }
      
      // Next call should be blocked by circuit breaker
      await expect(
        errorRecovery.executeWithCircuitBreaker(failFn, 'failing_operation')
      ).rejects.toThrow('Circuit breaker is open');
    });

    it('should track circuit breaker status', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('Test error'));
      
      // Trigger some failures
      for (let i = 0; i < 3; i++) {
        await expect(
          errorRecovery.executeWithCircuitBreaker(failFn, 'test_op')
        ).rejects.toThrow();
      }
      
      const status = errorRecovery.getRecoveryStatus();
      expect(status.circuitBreakers.length).toBeGreaterThan(0);
      
      const testOpBreaker = status.circuitBreakers.find(cb => cb.type === 'test_op');
      expect(testOpBreaker).toBeDefined();
      expect(testOpBreaker?.status.failures).toBeGreaterThan(0);
    });
  });

  describe('recovery actions', () => {
    it('should execute retry actions', async () => {
      const retryError = new Error('Temporary API failure');
      const context = {
        type: 'api' as const,
        message: 'API error',
        context: { retryable: true },
        timestamp: new Date(),
        day: 1
      };
      
      const actions = await errorRecovery.recoverFromError(retryError, context, agentState);
      
      expect(actions.some(a => a.type === 'retry')).toBe(true);
    });

    it('should execute conservative actions for financial errors', async () => {
      const financialError = new Error('Budget exceeded');
      const context = {
        type: 'financial' as const,
        message: 'Financial error',
        context: { budgetExceeded: true },
        timestamp: new Date(),
        day: 1
      };
      
      const actions = await errorRecovery.recoverFromError(financialError, context, agentState);
      
      expect(actions.some(a => a.type === 'conservative')).toBe(true);
    });

    it('should execute emergency stop for critical errors', async () => {
      // Force critical state
      const bankruptState = new AgentState(50, 100, 1);
      bankruptState.advanceDay();
      bankruptState.advanceDay();
      
      const criticalError = new Error('System critical failure');
      const context = {
        type: 'system' as const,
        message: 'Critical system error',
        context: { critical: true },
        timestamp: new Date(),
        day: 2
      };
      
      const actions = await errorRecovery.recoverFromError(criticalError, context, bankruptState);
      
      expect(actions.some(a => a.type === 'abort')).toBe(true);
    });
  });

  describe('error tracking and statistics', () => {
    it('should track error history', async () => {
      const errors = [
        new Error('Error 1'),
        new Error('Error 2'),
        new Error('Error 3')
      ];
      
      for (let i = 0; i < errors.length; i++) {
        await errorRecovery.recoverFromError(
          errors[i],
          {
            type: 'system',
            message: `Error ${i + 1}`,
            context: {},
            timestamp: new Date(),
            day: 1
          },
          agentState
        );
      }
      
      const stats = errorRecovery.getErrorStats();
      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType.system).toBe(3);
    });

    it('should provide comprehensive recovery status', async () => {
      await errorRecovery.recoverFromError(
        new Error('Test error'),
        {
          type: 'api',
          message: 'API error',
          context: {},
          timestamp: new Date(),
          day: 1
        },
        agentState
      );
      
      const status = errorRecovery.getRecoveryStatus();
      
      expect(status).toHaveProperty('recoveryMode');
      expect(status).toHaveProperty('circuitBreakers');
      expect(status).toHaveProperty('recentErrors');
      expect(status).toHaveProperty('recommendations');
      expect(Array.isArray(status.recommendations)).toBe(true);
    });

    it('should generate appropriate recommendations', async () => {
      // Generate multiple errors to trigger recommendations
      for (let i = 0; i < 8; i++) {
        await errorRecovery.recoverFromError(
          new Error(`Error ${i}`),
          {
            type: 'system',
            message: 'System error',
            context: {},
            timestamp: new Date(),
            day: 1
          },
          agentState
        );
      }
      
      const status = errorRecovery.getRecoveryStatus();
      expect(status.recommendations.some(r => r.includes('High error rate'))).toBe(true);
    });

    it('should clear error history when requested', async () => {
      await errorRecovery.recoverFromError(
        new Error('Test error'),
        {
          type: 'system',
          message: 'Test error',
          context: {},
          timestamp: new Date(),
          day: 1
        },
        agentState
      );
      
      expect(errorRecovery.getErrorStats().totalErrors).toBe(1);
      
      errorRecovery.clearErrorHistory();
      
      expect(errorRecovery.getErrorStats().totalErrors).toBe(0);
    });
  });

  describe('error frequency detection', () => {
    it('should detect high error frequency', async () => {
      // Generate many errors in short time
      for (let i = 0; i < 10; i++) {
        await errorRecovery.recoverFromError(
          new Error(`Frequent error ${i}`),
          {
            type: 'system',
            message: 'Frequent error',
            context: {},
            timestamp: new Date(),
            day: 1
          },
          agentState
        );
      }
      
      const status = errorRecovery.getRecoveryStatus();
      expect(status.recoveryMode).toBe(true);
    });

    it('should track errors by type over time', async () => {
      const errorTypes = ['api', 'financial', 'product', 'campaign'];
      
      for (let i = 0; i < 12; i++) {
        const errorType = errorTypes[i % errorTypes.length];
        await errorRecovery.recoverFromError(
          new Error(`${errorType} error`),
          {
            type: errorType as any,
            message: `${errorType} error`,
            context: {},
            timestamp: new Date(),
            day: 1
          },
          agentState
        );
      }
      
      const stats = errorRecovery.getErrorStats();
      expect(Object.keys(stats.errorsByType)).toHaveLength(4);
      expect(stats.errorsByType.api).toBe(3);
      expect(stats.errorsByType.financial).toBe(3);
    });
  });
});