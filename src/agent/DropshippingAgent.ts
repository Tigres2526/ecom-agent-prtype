import type { AgentConfig, Tool, ToolCall } from '../types/index.js';
import { GrokClient } from './GrokClient.js';
import { DecisionEngine } from './DecisionEngine.js';
import { ContextManager } from './ContextManager.js';
import { ErrorRecovery } from './ErrorRecovery.js';
import { FinancialTracker } from './FinancialTracker.js';
import { AgentState } from '../models/AgentState.js';
import { AgentMemory } from '../memory/AgentMemory.js';
import { VectorSearch } from '../memory/VectorSearch.js';
import { MemoryStore } from '../memory/MemoryStore.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { ProductResearchTools } from '../tools/ProductResearchTools.js';
import { CampaignManagementTools } from '../tools/CampaignManagementTools.js';
import { MarketingAngleTools } from '../tools/MarketingAngleTools.js';
import { MemoryTools } from '../tools/MemoryTools.js';
import { AnalyticsTools } from '../tools/AnalyticsTools.js';
import { OrderTrackingTools } from '../tools/OrderTrackingTools.js';
import { env } from '../config/environment.js';
import { MetricsCollector } from '../metrics/MetricsCollector.js';
import { ReportGenerator } from '../metrics/ReportGenerator.js';

/**
 * Main dropshipping agent that orchestrates all subsystems
 */
export class DropshippingAgent {
  private config: AgentConfig;
  private grokClient: GrokClient;
  private decisionEngine: DecisionEngine;
  private contextManager: ContextManager;
  private errorRecovery: ErrorRecovery;
  private financialTracker: FinancialTracker;
  private agentState: AgentState;
  private agentMemory: AgentMemory;
  private toolRegistry: ToolRegistry;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private memoryStore: MemoryStore;
  private metricsCollector: MetricsCollector;
  private reportGenerator: ReportGenerator;

  constructor(config: AgentConfig) {
    this.config = config;
    
    // Initialize core systems
    this.grokClient = new GrokClient();
    this.contextManager = new ContextManager(config.maxContextTokens || 30000);
    this.errorRecovery = new ErrorRecovery();
    this.financialTracker = new FinancialTracker();
    
    // Initialize state
    this.agentState = new AgentState(
      config.initialCapital,
      config.dailyAdSpend,
      config.bankruptcyThreshold || 10
    );
    
    // Initialize memory
    this.memoryStore = new MemoryStore();
    this.agentMemory = new AgentMemory();
    
    // Initialize metrics
    this.metricsCollector = new MetricsCollector(this.memoryStore);
    this.reportGenerator = new ReportGenerator(this.metricsCollector);
    
    // Initialize decision engine
    this.decisionEngine = new DecisionEngine(
      this.grokClient,
      this.contextManager,
      config
    );
    
    // Initialize tools
    const productTools = new ProductResearchTools(this.grokClient);
    const campaignTools = new CampaignManagementTools(this.grokClient);
    const marketingTools = new MarketingAngleTools(this.grokClient);
    const memoryTools = new MemoryTools(this.agentMemory, this.agentState);
    const analyticsTools = new AnalyticsTools(this.agentState);
    const orderTools = new OrderTrackingTools();
    
    this.toolRegistry = new ToolRegistry(
      productTools,
      campaignTools,
      marketingTools,
      memoryTools,
      analyticsTools,
      orderTools
    );
  }

  /**
   * Main run loop for the agent
   */
  public async run(): Promise<void> {
    console.log('🚀 Starting Dropshipping Agent');
    console.log(`💰 Initial Capital: $${this.config.initialCapital}`);
    console.log(`📊 Target ROAS: ${this.config.targetROAS}x`);
    console.log(`📅 Max Days: ${this.config.maxDays}`);
    console.log('');
    
    this.isRunning = true;
    
    try {
      while (this.isRunning && this.agentState.currentDay <= this.config.maxDays) {
        // Check for pause
        if (this.isPaused) {
          await this.sleep(1000);
          continue;
        }
        
        // Execute daily cycle with error recovery
        await this.errorRecovery.executeWithCircuitBreaker(
          async () => await this.executeDailyCycle(),
          'daily_cycle',
          `Day ${this.agentState.currentDay}`
        );
        
        // Check for bankruptcy
        if (this.agentState.isBankrupt()) {
          console.log('💀 Agent has gone bankrupt. Ending simulation.');
          break;
        }
        
        // Advance to next day
        this.agentState.advanceDay();
      }
    } catch (error) {
      console.error('Fatal error in agent run loop:', error);
      throw error;
    } finally {
      this.isRunning = false;
      await this.generateFinalReport();
    }
  }

  /**
   * Executes a single daily cycle
   */
  private async executeDailyCycle(): Promise<void> {
    const day = this.agentState.currentDay;
    console.log(`\n📅 Day ${day} Starting`);
    console.log('='.repeat(50));
    
    // Morning routine
    await this.morningRoutine();
    
    // Decision-making loop
    let actionsToday = 0;
    const maxActions = this.config.maxActionsPerDay || 50;
    
    while (actionsToday < maxActions && !this.shouldStopActions()) {
      try {
        // Make a decision
        const decision = await this.decisionEngine.makeDecision(
          this.agentState,
          this.toolRegistry.getAllTools()
        );
        
        // Log decision
        await this.logDecision(decision);
        
        // Execute tool calls if any
        if (decision.toolCalls && decision.toolCalls.length > 0) {
          for (const toolCall of decision.toolCalls) {
            await this.executeToolCall(toolCall);
            actionsToday++;
          }
        } else {
          // No tool calls means we're done for today
          break;
        }
        
        // Check financial health after each action
        const health = this.agentState.getFinancialHealth();
        if (health.status === 'critical' || health.status === 'bankrupt') {
          console.warn('⚠️ Critical financial status detected, stopping actions for today');
          break;
        }
      } catch (error) {
        console.error('Error in decision cycle:', error);
        const recovery = await this.errorRecovery.recoverFromError(
          error as Error,
          {
            type: 'system',
            message: 'Decision cycle error',
            context: { day, actionsToday },
            timestamp: new Date(),
            day
          },
          this.agentState
        );
        
        // If recovery suggests stopping, break
        if (recovery.some(r => r.type === 'abort')) {
          break;
        }
      }
    }
    
    // Evening routine
    await this.eveningRoutine();
    
    // Log daily summary
    await this.logDailySummary();
  }

  /**
   * Morning routine - check metrics and plan the day
   */
  private async morningRoutine(): Promise<void> {
    console.log('\n🌅 Morning Routine');
    
    // Update financial metrics
    const metrics = this.financialTracker.updateDailyMetrics(this.agentState);
    console.log(`💰 Net Worth: $${metrics.netWorth.toFixed(2)}`);
    console.log(`📊 Current ROAS: ${metrics.roas.toFixed(2)}x`);
    console.log(`🎯 Active Campaigns: ${metrics.activeCampaigns}`);
    console.log(`📦 Active Products: ${metrics.activeProducts}`);
    
    // Record state metrics
    this.metricsCollector.recordStateMetrics(this.agentState);
    
    // Check for financial alerts
    const alerts = this.financialTracker.getUnresolvedAlerts();
    if (alerts.length > 0) {
      console.log('\n⚠️ Financial Alerts:');
      alerts.forEach(alert => {
        console.log(`  - [${alert.type}] ${alert.message}`);
      });
    }
    
    // Memory cleanup (weekly)
    if (this.agentState.currentDay % 7 === 0) {
      console.log('\n🧹 Performing weekly memory cleanup');
      this.agentMemory.pruneOldMemories(this.agentState.currentDay);
      this.contextManager.pruneOldMessages();
    }
  }

  /**
   * Evening routine - optimize campaigns and reflect on the day
   */
  private async eveningRoutine(): Promise<void> {
    console.log('\n🌙 Evening Routine');
    
    // Calculate daily performance
    const campaigns = this.agentState.activeCampaigns.filter(c => c.status === 'active');
    const dailyRevenue = campaigns.reduce((sum, c) => {
      const daysRunning = Math.max(1, this.agentState.currentDay - c.createdDay);
      return sum + (c.revenue / daysRunning);
    }, 0);
    const dailySpend = campaigns.reduce((sum, c) => sum + c.budget, 0);
    const dailyROAS = dailySpend > 0 ? dailyRevenue / dailySpend : 0;
    
    console.log(`💵 Daily Revenue: $${dailyRevenue.toFixed(2)}`);
    console.log(`💸 Daily Spend: $${dailySpend.toFixed(2)}`);
    console.log(`📈 Daily ROAS: ${dailyROAS.toFixed(2)}x`);
    
    // Kill underperforming campaigns
    const killedCount = this.financialTracker.killLosingCampaigns(
      this.agentState
    );
    
    if (killedCount > 0) {
      console.log(`🔪 Killed ${killedCount} underperforming campaigns`);
    }
    
    // Store daily summary in memory
    await this.agentMemory.write(
      `daily_summary_day_${this.agentState.currentDay}`,
      JSON.stringify({
        day: this.agentState.currentDay,
        netWorth: this.agentState.netWorth,
        revenue: dailyRevenue,
        spend: dailySpend,
        roas: dailyROAS,
        activeCampaigns: campaigns.length,
        activeProducts: this.agentState.activeProducts.filter(p => p.status !== 'killed').length,
        killedCampaigns: killedCount,
      })
    );
    
    // Generate and display daily report
    const dailyReport = this.reportGenerator.generateDailyReport(this.agentState);
    console.log('\n📄 Daily Report Generated');
    
    // Generate weekly report on day 7 and multiples
    if (this.agentState.currentDay % 7 === 0) {
      const weeklyReport = this.reportGenerator.generateWeeklyReport(this.agentState);
      console.log('\n📊 Weekly Report Generated');
      
      // Store weekly report in memory
      await this.agentMemory.write(
        `weekly_report_week_${Math.floor(this.agentState.currentDay / 7)}`,
        JSON.stringify(weeklyReport)
      );
    }
  }

  /**
   * Logs a decision to memory and context
   */
  private async logDecision(decision: any): Promise<void> {
    console.log(`\n🤔 Decision: ${decision.decision}`);
    console.log(`📝 Reasoning: ${decision.reasoning}`);
    console.log(`🎯 Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
    
    // Store in memory
    await this.agentMemory.write(
      `decision_day_${this.agentState.currentDay}_${Date.now()}`,
      JSON.stringify(decision)
    );
    
    // Add to scratchpad
    await this.agentMemory.writeScratchpad(
      `decision_${Date.now()}`,
      decision.decision,
      'decision'
    );
    
    // The decision is already stored in vector memory via writeScratchpad
    // Log the decision metadata
    await this.agentMemory.logInsight(
      `Decision: ${decision.decision}\nReasoning: ${decision.reasoning}`,
      'decision'
    );
  }

  /**
   * Executes a tool call
   */
  private async executeToolCall(toolCall: ToolCall): Promise<void> {
    console.log(`\n🔧 Executing tool: ${toolCall.name}`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.toolRegistry.executeTool(
        toolCall.name,
        toolCall.parameters
      );
      
      const executionTime = Date.now() - startTime;
      
      if (result.success) {
        console.log('✅ Tool executed successfully');
        
        // Record decision metrics
        this.metricsCollector.recordDecisionMetrics({
          type: toolCall.name,
          confidence: 1.0, // Success
          executionTime,
          success: true
        });
        
        // Add result to context
        this.contextManager.addToolMessage(
          `Tool ${toolCall.name} executed successfully`,
          [result]
        );
        
        // Process specific tool results
        await this.processToolResult(toolCall.name, result);
      } else {
        console.error('❌ Tool execution failed:', result.error);
        
        // Record failed decision
        this.metricsCollector.recordDecisionMetrics({
          type: toolCall.name,
          confidence: 0.0, // Failure
          executionTime,
          success: false
        });
        
        // Log error for recovery
        await this.agentMemory.logError(
          result.error || 'Unknown tool error',
          {
            tool: toolCall.name,
            parameters: toolCall.parameters,
            day: this.agentState.currentDay,
          }
        );
      }
    } catch (error) {
      console.error('❌ Tool execution error:', error);
      throw error;
    }
  }

  /**
   * Processes tool results and updates state
   */
  private async processToolResult(toolName: string, result: any): Promise<void> {
    // Handle specific tool results
    switch (toolName) {
      case 'create_campaign':
        if (result.data?.campaign) {
          this.agentState.addCampaign(result.data.campaign);
          console.log(`📈 Added new campaign: ${result.data.campaign.id}`);
          
          // Record campaign metrics
          this.metricsCollector.recordCampaignMetrics(result.data.campaign.id, {
            revenue: 0,
            spend: result.data.campaign.budget,
            roas: 0,
            conversions: 0
          });
        }
        break;
        
      case 'analyze_product':
        if (result.data?.product) {
          this.agentState.addProduct(result.data.product);
          console.log(`📦 Added new product: ${result.data.product.name}`);
          
          // Record product metrics
          this.metricsCollector.recordProductMetrics(result.data.product.id, {
            sales: 0,
            revenue: 0,
            margin: result.data.product.margin
          });
        }
        break;
        
      case 'scale_campaign':
        if (result.data?.campaignId && result.data?.newBudget) {
          const campaign = this.agentState.activeCampaigns.find(
            c => c.id === result.data.campaignId
          );
          if (campaign) {
            campaign.budget = result.data.newBudget;
            console.log(`📈 Scaled campaign budget to $${result.data.newBudget}`);
          }
        }
        break;
        
      case 'kill_campaign':
        if (result.data?.campaignId) {
          const campaign = this.agentState.activeCampaigns.find(
            c => c.id === result.data.campaignId
          );
          if (campaign) {
            campaign.status = 'killed';
            console.log(`🔪 Killed campaign: ${campaign.id}`);
          }
        }
        break;
    }
  }

  /**
   * Determines if agent should stop taking actions
   */
  private shouldStopActions(): boolean {
    // Stop if in recovery mode
    if (this.errorRecovery.getRecoveryStatus().recoveryMode) {
      return true;
    }
    
    // Stop if excessive errors
    if (this.agentState.hasExcessiveErrors(5)) {
      return true;
    }
    
    // Stop if critical financial status
    const health = this.agentState.getFinancialHealth();
    if (health.status === 'critical' || health.status === 'bankrupt') {
      return true;
    }
    
    return false;
  }

  /**
   * Logs daily summary
   */
  private async logDailySummary(): Promise<void> {
    const summary = {
      day: this.agentState.currentDay,
      netWorth: this.agentState.netWorth,
      totalRevenue: this.agentState.totalRevenue,
      totalSpend: this.agentState.totalSpend,
      currentROAS: this.agentState.currentROAS,
      activeCampaigns: this.agentState.activeCampaigns.filter(c => c.status === 'active').length,
      activeProducts: this.agentState.activeProducts.filter(p => p.status !== 'killed').length,
      errorCount: this.agentState.errorCount,
      financialHealth: this.agentState.getFinancialHealth().status,
    };
    
    console.log('\n📊 Daily Summary:');
    console.log(JSON.stringify(summary, null, 2));
    
    // Store in memory
    this.memoryStore.writeScratchpad(
      `day_${this.agentState.currentDay}_summary`,
      JSON.stringify(summary),
      this.agentState.currentDay,
      'metric'
    );
  }

  /**
   * Generates final report at end of simulation
   */
  private async generateFinalReport(): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL REPORT');
    console.log('='.repeat(50));
    
    const finalMetrics = {
      totalDays: this.agentState.currentDay,
      finalNetWorth: this.agentState.netWorth,
      totalRevenue: this.agentState.totalRevenue,
      totalSpend: this.agentState.totalSpend,
      overallROAS: this.agentState.currentROAS,
      totalProducts: this.agentState.activeProducts.length,
      winningProducts: this.agentState.activeProducts.filter(p => p.status === 'scaling').length,
      totalCampaigns: this.agentState.activeCampaigns.length,
      successfulCampaigns: this.agentState.activeCampaigns.filter(c => c.roas > 2.0).length,
      totalErrors: this.agentState.errorCount,
      bankruptcyStatus: this.agentState.isBankrupt() ? 'BANKRUPT' : 'SURVIVED',
    };
    
    console.log(JSON.stringify(finalMetrics, null, 2));
    
    // Calculate ROI
    const roi = ((finalMetrics.finalNetWorth - this.config.initialCapital) / this.config.initialCapital) * 100;
    console.log(`\n💰 ROI: ${roi.toFixed(2)}%`);
    
    // Best performing products
    const bestProducts = [...this.agentState.activeProducts]
      .filter(p => p.status === 'scaling')
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 3);
    
    if (bestProducts.length > 0) {
      console.log('\n🏆 Top Products:');
      bestProducts.forEach((product, i) => {
        console.log(`  ${i + 1}. ${product.name} (${product.margin}% margin)`);
      });
    }
    
    // Best performing campaigns
    const bestCampaigns = [...this.agentState.activeCampaigns]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
    
    if (bestCampaigns.length > 0) {
      console.log('\n🏆 Top Campaigns:');
      bestCampaigns.forEach((campaign, i) => {
        console.log(`  ${i + 1}. ${campaign.platform} - ${campaign.angle} (${campaign.roas.toFixed(2)}x ROAS, $${campaign.revenue.toFixed(2)} revenue)`);
      });
    }
  }

  /**
   * Pauses the agent
   */
  public pause(): void {
    this.isPaused = true;
    console.log('⏸️ Agent paused');
  }

  /**
   * Resumes the agent
   */
  public resume(): void {
    this.isPaused = false;
    console.log('▶️ Agent resumed');
  }

  /**
   * Stops the agent
   */
  public stop(): void {
    this.isRunning = false;
    console.log('⏹️ Agent stopped');
  }

  /**
   * Gets current agent status
   */
  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentDay: this.agentState.currentDay,
      netWorth: this.agentState.netWorth,
      currentROAS: this.agentState.currentROAS,
      financialHealth: this.agentState.getFinancialHealth(),
      errorCount: this.agentState.errorCount,
      activeCampaigns: this.agentState.activeCampaigns.filter(c => c.status === 'active').length,
      activeProducts: this.agentState.activeProducts.filter(p => p.status !== 'killed').length,
    };
  }

  /**
   * Helper to sleep for a given duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets a performance report
   */
  public getPerformanceReport(): import('../types/index.js').PerformanceReport {
    return this.metricsCollector.generatePerformanceReport(this.agentState);
  }

  /**
   * Gets metrics for a specific type
   */
  public getMetrics(
    type: import('../types/index.js').MetricType,
    startDate?: Date,
    endDate?: Date
  ): import('../types/index.js').MetricSnapshot[] {
    return this.metricsCollector.getMetrics(type, startDate, endDate);
  }

  /**
   * Exports all metrics to CSV
   */
  public exportMetrics(outputDir: string): void {
    this.reportGenerator.exportAllMetricsCSV(outputDir);
  }

  /**
   * Gets a JSON report
   */
  public getJSONReport(): object {
    return this.reportGenerator.generateJSONReport(this.agentState);
  }
}