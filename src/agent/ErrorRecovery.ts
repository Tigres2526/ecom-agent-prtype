import type { 
  ErrorContext, 
  RecoveryAction
} from '../types/index.js';
import { AgentState } from '../models/AgentState.js';
import { Campaign } from '../models/Campaign.js';
import { Product } from '../models/Product.js';

/**
 * Circuit breaker implementation for preventing cascade failures
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;

  constructor(
    threshold: number = 5,
    timeout: number = 60000, // 1 minute
    resetTimeout: number = 300000 // 5 minutes
  ) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.resetTimeout = resetTimeout;
  }

  /**
   * Executes a function with circuit breaker protection
   */
  public async call<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
        console.log(`Circuit breaker transitioning to half-open state for: ${context}`);
      } else {
        throw new Error(`Circuit breaker is open for: ${context || 'unknown operation'}`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), this.timeout)
        )
      ]);

      // Success - reset failure count and close circuit if half-open
      if (this.state === 'half-open') {
        this.state = 'closed';
        console.log(`Circuit breaker closed after successful recovery for: ${context}`);
      }
      this.failures = 0;
      return result;
    } catch (error) {
      this.recordFailure();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
        this.lastFailureTime = Date.now();
        console.error(`Circuit breaker opened due to ${this.failures} failures for: ${context}`);
      }
      
      throw error;
    }
  }

  /**
   * Records a failure and updates circuit state
   */
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }

  /**
   * Gets current circuit breaker status
   */
  public getStatus(): {
    state: string;
    failures: number;
    threshold: number;
    lastFailureTime: number;
    timeUntilReset?: number;
  } {
    const status = {
      state: this.state,
      failures: this.failures,
      threshold: this.threshold,
      lastFailureTime: this.lastFailureTime
    };

    if (this.state === 'open') {
      const timeUntilReset = this.resetTimeout - (Date.now() - this.lastFailureTime);
      return { ...status, timeUntilReset: Math.max(0, timeUntilReset) };
    }

    return status;
  }

  /**
   * Manually resets the circuit breaker
   */
  public reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
    console.log('Circuit breaker manually reset');
  }

  /**
   * Checks if circuit breaker is currently blocking calls
   */
  public isOpen(): boolean {
    return this.state === 'open' && 
           (Date.now() - this.lastFailureTime) < this.resetTimeout;
  }
}

/**
 * Comprehensive error recovery system for the dropshipping agent
 */
export class ErrorRecovery {
  private circuitBreakers: Map<string, CircuitBreaker>;
  private errorHistory: ErrorContext[];
  private recoveryActions: Map<string, RecoveryAction[]>;
  private maxErrorHistory: number;
  private recoveryMode: boolean = false;
  private recoveryStartTime: number = 0;

  constructor(maxErrorHistory: number = 1000) {
    this.circuitBreakers = new Map();
    this.errorHistory = [];
    this.recoveryActions = new Map();
    this.maxErrorHistory = maxErrorHistory;
    this.initializeRecoveryStrategies();
  }

  /**
   * Main error recovery handler
   */
  public async recoverFromError(
    error: Error,
    context: ErrorContext,
    agentState: AgentState
  ): Promise<RecoveryAction[]> {
    // Log the error
    this.logError(error, context);
    
    // Determine error category and severity
    const errorCategory = this.categorizeError(error, context);
    const severity = this.assessErrorSeverity(error, context, agentState);
    
    // Check if we should enter recovery mode
    if (this.shouldEnterRecoveryMode(agentState, severity)) {
      await this.enterRecoveryMode(agentState);
    }
    
    // Get appropriate recovery actions
    const recoveryActions = this.getRecoveryActions(errorCategory, severity, agentState);
    
    // Execute recovery actions
    const executedActions = await this.executeRecoveryActions(recoveryActions, agentState);
    
    // Update circuit breakers
    this.updateCircuitBreakers(errorCategory, error);
    
    return executedActions;
  }

  /**
   * Executes a function with circuit breaker protection
   */
  public async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationType: string,
    context?: string
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(operationType);
    return await circuitBreaker.call(operation, context);
  }

  /**
   * Logs error with context
   */
  private logError(error: Error, context: ErrorContext): void {
    const errorEntry: ErrorContext = {
      ...context,
      message: error.message,
      stack: error.stack,
      timestamp: new Date()
    };
    
    this.errorHistory.push(errorEntry);
    
    // Maintain error history size
    if (this.errorHistory.length > this.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxErrorHistory);
    }
    
    console.error(`Error logged [${context.type}]:`, {
      message: error.message,
      context: context.context,
      day: context.day
    });
  }

  /**
   * Categorizes error by type and cause
   */
  private categorizeError(error: Error, context: ErrorContext): string {
    const message = error.message.toLowerCase();
    
    // API-related errors
    if (message.includes('api') || message.includes('network') || message.includes('timeout')) {
      return 'api';
    }
    
    // Financial errors
    if (message.includes('budget') || message.includes('insufficient') || message.includes('bankrupt')) {
      return 'financial';
    }
    
    // Product-related errors
    if (message.includes('product') || message.includes('supplier') || message.includes('inventory')) {
      return 'product';
    }
    
    // Campaign errors
    if (message.includes('campaign') || message.includes('ad') || message.includes('roas')) {
      return 'campaign';
    }
    
    // Memory errors
    if (message.includes('memory') || message.includes('context') || message.includes('storage')) {
      return 'memory';
    }
    
    return context.type || 'system';
  }

  /**
   * Assesses error severity based on context and agent state
   */
  private assessErrorSeverity(
    error: Error,
    context: ErrorContext,
    agentState: AgentState
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors
    if (agentState.isBankrupt() || agentState.netWorth < 0) {
      return 'critical';
    }
    
    if (error.message.includes('bankrupt') || error.message.includes('critical')) {
      return 'critical';
    }
    
    // High severity errors
    if (agentState.hasExcessiveErrors() || agentState.getFinancialHealth().status === 'critical') {
      return 'high';
    }
    
    if (this.getRecentErrorCount(context.type, 300000) > 5) { // 5 errors in 5 minutes
      return 'high';
    }
    
    // Medium severity
    if (agentState.getFinancialHealth().status === 'warning') {
      return 'medium';
    }
    
    if (this.getRecentErrorCount(context.type, 600000) > 3) { // 3 errors in 10 minutes
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Determines if agent should enter recovery mode
   */
  private shouldEnterRecoveryMode(agentState: AgentState, severity: string): boolean {
    if (this.recoveryMode) {
      return false; // Already in recovery mode
    }
    
    if (severity === 'critical') {
      return true;
    }
    
    if (agentState.hasExcessiveErrors(10)) {
      return true;
    }
    
    // Check error frequency
    const recentErrors = this.getRecentErrors(300000); // Last 5 minutes
    if (recentErrors.length > 8) {
      return true;
    }
    
    return false;
  }

  /**
   * Enters recovery mode with conservative strategy
   */
  private async enterRecoveryMode(agentState: AgentState): Promise<void> {
    if (this.recoveryMode) {
      return;
    }
    
    console.warn('🚨 ENTERING RECOVERY MODE - Implementing conservative strategy');
    
    this.recoveryMode = true;
    this.recoveryStartTime = Date.now() - 1; // Ensure duration is at least 1ms
    
    // Implement conservative measures
    const recoveryActions: RecoveryAction[] = [
      {
        type: 'conservative',
        description: 'Kill all losing campaigns (ROAS < 1.5)',
        parameters: { minROAS: 1.5 }
      },
      {
        type: 'conservative',
        description: 'Reduce budgets on all active campaigns by 50%',
        parameters: { reductionFactor: 0.5 }
      },
      {
        type: 'conservative',
        description: 'Pause all new product launches',
        parameters: { pauseNewProducts: true }
      },
      {
        type: 'reset',
        description: 'Clear error counters and reset circuit breakers',
        parameters: { resetAll: true }
      }
    ];
    
    await this.executeRecoveryActions(recoveryActions, agentState);
  }

  /**
   * Exits recovery mode when conditions improve
   */
  public async exitRecoveryMode(agentState: AgentState): Promise<boolean> {
    if (!this.recoveryMode) {
      return false;
    }
    
    const timeSinceRecovery = Date.now() - this.recoveryStartTime;
    const minRecoveryTime = 600000; // 10 minutes minimum
    
    if (timeSinceRecovery < minRecoveryTime) {
      return false;
    }
    
    // Check if conditions have improved
    const recentErrors = this.getRecentErrors(300000);
    const financialHealth = agentState.getFinancialHealth();
    
    const canExit = (
      recentErrors.length < 3 &&
      !agentState.hasExcessiveErrors(5) &&
      financialHealth.status !== 'critical' &&
      agentState.netWorth > 0
    );
    
    if (canExit) {
      console.log('✅ EXITING RECOVERY MODE - Conditions have improved');
      this.recoveryMode = false;
      this.recoveryStartTime = 0;
      
      // Reset circuit breakers
      this.circuitBreakers.forEach(cb => cb.reset());
      
      return true;
    }
    
    return false;
  }

  /**
   * Gets appropriate recovery actions for error type and severity
   */
  private getRecoveryActions(
    errorCategory: string,
    severity: string,
    agentState: AgentState
  ): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    
    // Get base actions for error category
    const categoryActions = this.recoveryActions.get(errorCategory) || [];
    actions.push(...categoryActions);
    
    // Add severity-specific actions
    if (severity === 'critical') {
      actions.push({
        type: 'abort',
        description: 'Emergency stop all operations',
        parameters: { emergency: true }
      });
    } else if (severity === 'high') {
      actions.push({
        type: 'conservative',
        description: 'Enter conservative mode',
        parameters: { conservativeMode: true }
      });
    }
    
    // Add financial protection if needed
    if (agentState.getAvailableBudget() < 100) {
      actions.push({
        type: 'conservative',
        description: 'Reduce all campaign budgets by 30%',
        parameters: { budgetReduction: 0.3 }
      });
    }
    
    return actions;
  }

  /**
   * Executes recovery actions
   */
  private async executeRecoveryActions(
    actions: RecoveryAction[],
    agentState: AgentState
  ): Promise<RecoveryAction[]> {
    const executedActions: RecoveryAction[] = [];
    
    for (const action of actions) {
      try {
        await this.executeRecoveryAction(action, agentState);
        executedActions.push(action);
        console.log(`✅ Executed recovery action: ${action.description}`);
      } catch (error) {
        console.error(`❌ Failed to execute recovery action: ${action.description}`, error);
      }
    }
    
    return executedActions;
  }

  /**
   * Executes a single recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction, agentState: AgentState): Promise<void> {
    switch (action.type) {
      case 'retry':
        // Retry logic would be handled by the calling code
        break;
        
      case 'fallback':
        // Switch to fallback systems
        await this.activateFallbackSystems(action.parameters || {});
        break;
        
      case 'conservative':
        await this.implementConservativeStrategy(action.parameters || {}, agentState);
        break;
        
      case 'reset':
        await this.resetSystems(action.parameters || {});
        break;
        
      case 'abort':
        await this.emergencyStop(agentState);
        break;
        
      default:
        console.warn(`Unknown recovery action type: ${action.type}`);
    }
  }

  /**
   * Implements conservative strategy
   */
  private async implementConservativeStrategy(
    parameters: Record<string, any>,
    agentState: AgentState
  ): Promise<void> {
    if (parameters.minROAS) {
      // Kill campaigns below minimum ROAS
      const campaignsToKill = agentState.activeCampaigns.filter(
        campaign => campaign.roas < parameters.minROAS
      );
      
      for (const campaign of campaignsToKill) {
        campaign.status = 'killed';
        console.log(`Killed campaign ${campaign.id} due to low ROAS: ${campaign.roas}`);
      }
    }
    
    if (parameters.reductionFactor) {
      // Reduce campaign budgets
      agentState.activeCampaigns.forEach(campaign => {
        if (campaign.status === 'active') {
          campaign.budget *= parameters.reductionFactor;
          console.log(`Reduced budget for campaign ${campaign.id} by ${(1 - parameters.reductionFactor) * 100}%`);
        }
      });
    }
    
    if (parameters.pauseNewProducts) {
      // Mark products as paused for new launches
      agentState.activeProducts.forEach(product => {
        if (product.status === 'researching') {
          product.status = 'killed';
          console.log(`Paused product research for: ${product.name}`);
        }
      });
    }
  }

  /**
   * Activates fallback systems
   */
  private async activateFallbackSystems(parameters: Record<string, any>): Promise<void> {
    console.log('Activating fallback systems:', parameters);
    // Implementation would depend on specific fallback systems available
  }

  /**
   * Resets systems and clears errors
   */
  private async resetSystems(parameters: Record<string, any>): Promise<void> {
    if (parameters.resetAll) {
      // Reset circuit breakers
      this.circuitBreakers.forEach(cb => cb.reset());
      
      // Clear recent error history (keep some for analysis)
      const keepCount = Math.floor(this.errorHistory.length * 0.1);
      this.errorHistory = this.errorHistory.slice(-keepCount);
      
      console.log('Systems reset - circuit breakers and error history cleared');
    }
  }

  /**
   * Emergency stop all operations
   */
  private async emergencyStop(agentState: AgentState): Promise<void> {
    console.error('🛑 EMERGENCY STOP ACTIVATED');
    
    // Kill all active campaigns
    agentState.activeCampaigns.forEach(campaign => {
      campaign.status = 'killed';
    });
    
    // Stop all product research
    agentState.activeProducts.forEach(product => {
      if (product.status !== 'killed') {
        product.status = 'killed';
      }
    });
    
    console.error('All operations stopped due to critical errors');
  }

  /**
   * Gets or creates circuit breaker for operation type
   */
  private getOrCreateCircuitBreaker(operationType: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationType)) {
      this.circuitBreakers.set(operationType, new CircuitBreaker());
    }
    return this.circuitBreakers.get(operationType)!;
  }

  /**
   * Updates circuit breakers based on error
   */
  private updateCircuitBreakers(errorCategory: string, error: Error): void {
    const circuitBreaker = this.getOrCreateCircuitBreaker(errorCategory);
    // Circuit breaker is updated automatically when used with executeWithCircuitBreaker
  }

  /**
   * Gets recent error count for specific type
   */
  private getRecentErrorCount(errorType: string, timeWindow: number): number {
    const cutoff = Date.now() - timeWindow;
    return this.errorHistory.filter(
      error => error.type === errorType && error.timestamp.getTime() > cutoff
    ).length;
  }

  /**
   * Gets recent errors within time window
   */
  private getRecentErrors(timeWindow: number): ErrorContext[] {
    const cutoff = Date.now() - timeWindow;
    return this.errorHistory.filter(error => error.timestamp.getTime() > cutoff);
  }

  /**
   * Initializes recovery strategies for different error types
   */
  private initializeRecoveryStrategies(): void {
    // API error recovery
    this.recoveryActions.set('api', [
      {
        type: 'retry',
        description: 'retry API call with exponential backoff',
        parameters: { maxRetries: 3, backoffMultiplier: 2 }
      },
      {
        type: 'fallback',
        description: 'Use cached data if available',
        parameters: { useCachedData: true }
      }
    ]);
    
    // Financial error recovery
    this.recoveryActions.set('financial', [
      {
        type: 'conservative',
        description: 'Reduce campaign budgets immediately',
        parameters: { budgetReduction: 0.5 }
      },
      {
        type: 'conservative',
        description: 'Kill campaigns with ROAS < 1.0',
        parameters: { minROAS: 1.0 }
      }
    ]);
    
    // Product error recovery
    this.recoveryActions.set('product', [
      {
        type: 'retry',
        description: 'Re-analyze affected products',
        parameters: { reanalyzeProducts: true }
      },
      {
        type: 'fallback',
        description: 'Use alternative product sources',
        parameters: { useAlternativeSources: true }
      }
    ]);
    
    // Campaign error recovery
    this.recoveryActions.set('campaign', [
      {
        type: 'conservative',
        description: 'Pause underperforming campaigns',
        parameters: { pauseUnderperforming: true }
      },
      {
        type: 'reset',
        description: 'Reset campaign optimization settings',
        parameters: { resetOptimization: true }
      }
    ]);
    
    // Memory error recovery
    this.recoveryActions.set('memory', [
      {
        type: 'reset',
        description: 'Clear memory cache and restart',
        parameters: { clearMemoryCache: true }
      },
      {
        type: 'conservative',
        description: 'Reduce memory usage',
        parameters: { reduceMemoryUsage: true }
      }
    ]);
  }

  /**
   * Gets comprehensive error recovery status
   */
  public getRecoveryStatus(): {
    recoveryMode: boolean;
    recoveryDuration?: number;
    circuitBreakers: Array<{
      type: string;
      status: ReturnType<CircuitBreaker['getStatus']>;
    }>;
    recentErrors: {
      total: number;
      byType: Record<string, number>;
      last24Hours: number;
    };
    recommendations: string[];
  } {
    const circuitBreakerStatus = Array.from(this.circuitBreakers.entries()).map(
      ([type, cb]) => ({
        type,
        status: cb.getStatus()
      })
    );
    
    const recentErrors = this.getRecentErrors(86400000); // 24 hours
    const errorsByType: Record<string, number> = {};
    
    recentErrors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });
    
    const recommendations = this.generateRecoveryRecommendations();
    
    return {
      recoveryMode: this.recoveryMode,
      recoveryDuration: this.recoveryMode ? Date.now() - this.recoveryStartTime : undefined,
      circuitBreakers: circuitBreakerStatus,
      recentErrors: {
        total: this.errorHistory.length,
        byType: errorsByType,
        last24Hours: recentErrors.length
      },
      recommendations
    };
  }

  /**
   * Generates recovery recommendations based on current state
   */
  private generateRecoveryRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.recoveryMode) {
      recommendations.push('Currently in recovery mode - monitor for improvement');
    }
    
    const openCircuitBreakers = Array.from(this.circuitBreakers.entries())
      .filter(([, cb]) => cb.isOpen());
    
    if (openCircuitBreakers.length > 0) {
      recommendations.push(`${openCircuitBreakers.length} circuit breakers are open - check system health`);
    }
    
    const recentErrors = this.getRecentErrors(3600000); // 1 hour
    if (recentErrors.length > 5) {
      recommendations.push('High error rate detected - consider manual intervention');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System operating normally');
    }
    
    return recommendations;
  }

  /**
   * Clears error history (for testing or maintenance)
   */
  public clearErrorHistory(): void {
    this.errorHistory = [];
    console.log('Error history cleared');
  }

  /**
   * Gets error statistics
   */
  public getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByDay: Record<string, number>;
    averageErrorsPerDay: number;
  } {
    const errorsByType: Record<string, number> = {};
    const errorsByDay: Record<string, number> = {};
    
    this.errorHistory.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      
      const day = error.timestamp.toISOString().split('T')[0];
      errorsByDay[day] = (errorsByDay[day] || 0) + 1;
    });
    
    const days = Object.keys(errorsByDay).length;
    const averageErrorsPerDay = days > 0 ? this.errorHistory.length / days : 0;
    
    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsByDay,
      averageErrorsPerDay
    };
  }
}