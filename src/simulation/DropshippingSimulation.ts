import type { 
  AgentConfig, 
  AgentState, 
  SimulationResult, 
  DailyMetrics,
  DecisionLog 
} from '../types/index.js';
import { AgentState as AgentStateClass } from '../models/AgentState.js';
import { FinancialTracker } from '../agent/FinancialTracker.js';
import { ErrorRecovery } from '../agent/ErrorRecovery.js';
import { DecisionEngine } from '../agent/DecisionEngine.js';
import { ContextManager } from '../agent/ContextManager.js';
import { GrokClient } from '../agent/GrokClient.js';
import { AgentMemory } from '../memory/AgentMemory.js';
import { ProductResearchTools } from '../tools/ProductResearchTools.js';
import { CampaignManagementTools } from '../tools/CampaignManagementTools.js';
import { MarketingAngleTools } from '../tools/MarketingAngleTools.js';

/**
 * Daily simulation engine for the dropshipping agent
 */
export class DropshippingSimulation {
  private config: AgentConfig;
  private agentState: AgentStateClass;
  private financialTracker: FinancialTracker;
  private errorRecovery: ErrorRecovery;
  private decisionEngine: DecisionEngine;
  private contextManager: ContextManager;
  private memory: AgentMemory;
  private grokClient: GrokClient;
  
  // Tools
  private productTools: ProductResearchTools;
  private campaignTools: CampaignManagementTools;
  private angleTools: MarketingAngleTools;
  
  // Simulation state
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private dailyMetricsHistory: DailyMetrics[] = [];
  private decisionHistory: DecisionLog[] = [];
  private simulationStartTime: Date = new Date();
  private lastDayProcessed: number = 0;

  constructor(config: AgentConfig) {
    this.config = {
      ...config
    };

    // Initialize core systems
    this.agentState = new AgentStateClass(
      this.config.initialCapital,
      this.config.dailyAdSpend,
      this.config.bankruptcyThreshold
    );
    
    this.financialTracker = new FinancialTracker(
      this.config.targetROAS * 0.75, // Min ROAS threshold
      this.config.dailyAdSpend * 10, // Max daily spend limit
      Math.max(100, this.config.initialCapital * 0.1) // Emergency reserve
    );
    
    this.contextManager = new ContextManager(this.config.maxContextTokens);
    this.memory = new AgentMemory();
    this.grokClient = new GrokClient();
    this.errorRecovery = new ErrorRecovery();
    
    this.decisionEngine = new DecisionEngine(
      this.grokClient,
      this.contextManager,
      this.config
    );
    
    // Initialize tools
    this.productTools = new ProductResearchTools(this.grokClient);
    this.campaignTools = new CampaignManagementTools(this.grokClient);
    this.angleTools = new MarketingAngleTools(this.grokClient);
  }

  /**
   * Runs the complete simulation
   */
  public async run(): Promise<SimulationResult> {
    console.log('🚀 Starting Dropshipping AI Agent Simulation');
    console.log(`Configuration: ${this.config.maxDays} days, $${this.config.initialCapital} initial capital`);
    
    this.isRunning = true;
    this.simulationStartTime = new Date();
    
    try {
      // Initialize simulation
      await this.initializeSimulation();
      
      // Main simulation loop
      for (let day = 1; day <= this.config.maxDays && this.isRunning; day++) {
        if (this.isPaused) {
          await this.waitForResume();
        }
        
        console.log(`\n📅 === DAY ${day} ===`);
        
        try {
          await this.runDay(day);
          this.lastDayProcessed = day;
          
          // Check for bankruptcy
          if (this.agentState.isBankrupt()) {
            console.log('💀 Agent declared bankruptcy - simulation ending');
            break;
          }
          
          // Brief pause between days for realistic simulation
          await this.sleep(100);
          
        } catch (error) {
          console.error(`Error on day ${day}:`, error);
          
          // Use error recovery system
          await this.errorRecovery.recoverFromError(
            error as Error,
            {
              type: 'system',
              message: `Day ${day} simulation error`,
              context: { day, simulationDay: true },
              timestamp: new Date(),
              day
            },
            this.agentState
          );
          
          // Continue simulation unless it's a critical error
          if (this.agentState.isBankrupt()) {
            break;
          }
        }
      }
      
      return await this.generateSimulationResult();
      
    } catch (error) {
      console.error('Critical simulation error:', error);
      return await this.generateSimulationResult(error as Error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Runs a single day of simulation
   */
  private async runDay(day: number): Promise<void> {
    // Update agent state for new day
    this.agentState.advanceDay();
    this.memory.setCurrentDay(day);
    
    // Morning routine
    await this.morningRoutine(day);
    
    // Main decision-making loop
    let actionsToday = 0;
    const maxActions = this.config.maxActionsPerDay;
    
    while (actionsToday < maxActions && this.isRunning && !this.isPaused) {
      try {
        // Make a strategic decision
        const decision = await this.makeStrategicDecision(day);
        
        if (decision) {
          // Execute the decision
          await this.executeDecision(decision, day);
          actionsToday++;
          
          // Log the decision
          this.logDecision(decision, day);
          
          // Brief pause between actions
          await this.sleep(50);
        } else {
          // No more actions needed today
          break;
        }
        
      } catch (error) {
        console.error(`Action error on day ${day}:`, error);
        actionsToday++; // Count failed actions to prevent infinite loops
        
        // Use error recovery
        await this.errorRecovery.recoverFromError(
          error as Error,
          {
            type: 'system',
            message: `Action error on day ${day}`,
            context: { day, action: actionsToday },
            timestamp: new Date(),
            day
          },
          this.agentState
        );
      }
    }
    
    // Evening routine
    await this.eveningRoutine(day);
    
    console.log(`Day ${day} completed: ${actionsToday} actions taken`);
  }

  /**
   * Morning routine - metrics checking and financial updates
   */
  private async morningRoutine(day: number): Promise<void> {
    console.log('🌅 Morning routine starting...');
    
    try {
      // Update financial metrics
      const dailyMetrics = this.financialTracker.updateDailyMetrics(this.agentState);
      this.dailyMetricsHistory.push(dailyMetrics);
      
      // Log daily status
      console.log(`💰 Net Worth: $${this.agentState.netWorth.toFixed(2)}`);
      console.log(`📊 ROAS: ${this.agentState.currentROAS.toFixed(2)}`);
      console.log(`🎯 Active Campaigns: ${this.agentState.activeCampaigns.length}`);
      console.log(`📦 Active Products: ${this.agentState.activeProducts.length}`);
      
      // Check for financial alerts
      const alerts = this.financialTracker.getUnresolvedAlerts();
      if (alerts.length > 0) {
        console.warn(`⚠️  ${alerts.length} financial alerts active`);
        alerts.forEach(alert => {
          console.warn(`   - ${alert.type.toUpperCase()}: ${alert.message}`);
        });
      }
      
      // Update campaign metrics (simulate overnight performance)
      if (this.agentState.activeCampaigns.length > 0) {
        const metricsResult = await this.campaignTools.checkMetrics();
        if (metricsResult.success) {
          console.log(`📈 Campaign metrics updated: ${metricsResult.data.summary.totalCampaigns} campaigns checked`);
          
          // Update agent state with new revenue/spend
          const summary = metricsResult.data.summary;
          if (summary.totalRevenue > 0 || summary.totalSpend > 0) {
            this.agentState.updateFinancials(summary.totalRevenue, summary.totalSpend);
          }
        }
      }
      
      // Memory maintenance
      if (day % 7 === 0) { // Weekly memory cleanup
        const pruned = await this.memory.pruneOldMemories(30);
        if (pruned.memoryPruned > 0 || pruned.vectorsPruned > 0) {
          console.log(`🧹 Memory cleanup: ${pruned.memoryPruned} entries, ${pruned.vectorsPruned} vectors pruned`);
        }
      }
      
      // Log morning summary to memory
      await this.memory.logMetric('daily_net_worth', this.agentState.netWorth);
      await this.memory.logMetric('daily_roas', this.agentState.currentROAS);
      
    } catch (error) {
      console.error('Morning routine error:', error);
      throw error;
    }
  }

  /**
   * Evening routine - campaign optimization and memory pruning
   */
  private async eveningRoutine(day: number): Promise<void> {
    console.log('🌙 Evening routine starting...');
    
    try {
      // Optimize campaigns
      await this.optimizeCampaigns();
      
      // Kill underperforming campaigns
      await this.pruneLosingCampaigns();
      
      // Plan tomorrow's activities
      await this.planNextDay(day + 1);
      
      // Generate daily summary
      const summary = await this.generateDailySummary(day);
      await this.memory.writeScratchpad(`day_${day}_summary`, summary, 'insight');
      
      // Check if we should exit recovery mode
      if (this.errorRecovery.getRecoveryStatus().recoveryMode) {
        await this.errorRecovery.exitRecoveryMode(this.agentState);
      }
      
      console.log('🌙 Evening routine completed');
      
    } catch (error) {
      console.error('Evening routine error:', error);
      // Don't throw - evening routine errors shouldn't stop simulation
    }
  }

  /**
   * Makes a strategic decision using the decision engine
   */
  private async makeStrategicDecision(day: number): Promise<any> {
    try {
      const availableTools = this.getAvailableTools();
      const context = this.generateDecisionContext(day);
      
      const decision = await this.decisionEngine.makeDecision(
        this.agentState,
        availableTools,
        context
      );
      
      return decision;
      
    } catch (error) {
      console.error('Decision making error:', error);
      return null;
    }
  }

  /**
   * Executes a decision made by the decision engine
   */
  private async executeDecision(decision: any, day: number): Promise<void> {
    console.log(`🎯 Executing decision: ${decision.decision}`);
    
    if (decision.toolCalls && decision.toolCalls.length > 0) {
      for (const toolCall of decision.toolCalls) {
        try {
          const result = await this.executeTool(toolCall);
          console.log(`✅ Tool ${toolCall.name} executed successfully`);
          
          // Log tool result to memory
          await this.memory.logDecision(
            `Executed ${toolCall.name}`,
            decision.reasoning,
            `Day ${day} decision execution`,
            result.success ? 'Success' : 'Failed',
            decision.confidence
          );
          
        } catch (error) {
          console.error(`❌ Tool ${toolCall.name} failed:`, error);
          
          await this.memory.logError(
            `Tool execution failed: ${toolCall.name}`,
            { toolCall, error: (error as Error).message, day }
          );
        }
      }
    }
  }

  /**
   * Executes a specific tool call
   */
  private async executeTool(toolCall: any): Promise<any> {
    const { name, parameters } = toolCall;
    
    switch (name) {
      case 'search_products':
        return await this.productTools.searchProducts(parameters);
        
      case 'analyze_product':
        return await this.productTools.analyzeProduct(parameters);
        
      case 'spy_competitors':
        return await this.productTools.spyCompetitors(parameters.productName, parameters.platform);
        
      case 'generate_angles':
        return await this.angleTools.generateAngles(
          parameters.product,
          parameters.competitorIntel,
          parameters.existingAngles,
          parameters.targetCount
        );
        
      case 'test_angles':
        return await this.angleTools.testAngles(
          parameters.angles,
          parameters.testBudget,
          parameters.testDuration
        );
        
      case 'create_campaign':
        return await this.campaignTools.createCampaign(parameters);
        
      case 'scale_campaign':
        return await this.campaignTools.scaleCampaign(parameters);
        
      case 'kill_campaign':
        return await this.campaignTools.killCampaign(parameters);
        
      case 'optimize_campaign':
        return await this.campaignTools.optimizeCampaign(parameters.campaignId);
        
      case 'check_metrics':
        return await this.campaignTools.checkMetrics();
        
      case 'write_memory':
        await this.memory.write(parameters.key, parameters.value, parameters.type);
        return { success: true, data: 'Memory written' };
        
      case 'read_memory':
        const memoryResult = this.memory.read(parameters.key);
        return { success: true, data: memoryResult };
        
      case 'vector_search':
        const searchResults = await this.memory.searchVector(parameters.query, parameters.limit);
        return { success: true, data: searchResults };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Gets available tools for the decision engine
   */
  private getAvailableTools(): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'search_products',
          description: 'Search for dropshipping products',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              minPrice: { type: 'number' },
              maxPrice: { type: 'number' },
              platform: { type: 'string', enum: ['aliexpress', 'amazon', 'all'] }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'analyze_product',
          description: 'Analyze a product for dropshipping potential',
          parameters: {
            type: 'object',
            properties: {
              productUrl: { type: 'string' },
              targetMargin: { type: 'number' }
            },
            required: ['productUrl']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'generate_angles',
          description: 'Generate marketing angles for a product',
          parameters: {
            type: 'object',
            properties: {
              product: { type: 'object' },
              competitorIntel: { type: 'object' },
              existingAngles: { type: 'array' },
              targetCount: { type: 'number' }
            },
            required: ['product']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_campaign',
          description: 'Create a new advertising campaign',
          parameters: {
            type: 'object',
            properties: {
              product: { type: 'object' },
              angle: { type: 'object' },
              budget: { type: 'number' },
              platform: { type: 'string', enum: ['facebook', 'tiktok', 'google'] }
            },
            required: ['product', 'angle', 'budget', 'platform']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'scale_campaign',
          description: 'Scale a winning campaign',
          parameters: {
            type: 'object',
            properties: {
              campaignId: { type: 'string' },
              newBudget: { type: 'number' },
              reason: { type: 'string' }
            },
            required: ['campaignId', 'newBudget', 'reason']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'kill_campaign',
          description: 'Kill an underperforming campaign',
          parameters: {
            type: 'object',
            properties: {
              campaignId: { type: 'string' },
              reason: { type: 'string' }
            },
            required: ['campaignId', 'reason']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'check_metrics',
          description: 'Check current campaign metrics',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'write_memory',
          description: 'Write information to memory',
          parameters: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
              type: { type: 'string', enum: ['decision', 'metric', 'insight', 'error'] }
            },
            required: ['key', 'value']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'vector_search',
          description: 'Search memory using semantic similarity',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              limit: { type: 'number' }
            },
            required: ['query']
          }
        }
      }
    ];
  }

  /**
   * Generates decision context for the AI
   */
  private generateDecisionContext(day: number): string {
    const financialHealth = this.agentState.getFinancialHealth();
    const availableBudget = this.agentState.getAvailableBudget();
    const alerts = this.financialTracker.getUnresolvedAlerts();
    
    return `Day ${day} Context:
- Financial Health: ${financialHealth.status}
- Available Budget: $${availableBudget.toFixed(2)}
- Days Until Bankruptcy: ${financialHealth.daysUntilBankruptcy || 'N/A'}
- Active Alerts: ${alerts.length}
- Recent Performance: ROAS ${this.agentState.currentROAS.toFixed(2)}
- Recommendation: ${financialHealth.recommendation}`;
  }

  /**
   * Optimizes existing campaigns
   */
  private async optimizeCampaigns(): Promise<void> {
    const activeCampaigns = this.agentState.activeCampaigns.filter(c => c.status === 'active');
    
    for (const campaign of activeCampaigns) {
      try {
        // Only optimize campaigns that haven't been optimized recently
        const daysSinceOptimization = this.agentState.currentDay - campaign.lastOptimized;
        if (daysSinceOptimization >= 2) {
          await this.campaignTools.optimizeCampaign(campaign.id);
          campaign.lastOptimized = this.agentState.currentDay;
        }
      } catch (error) {
        console.error(`Failed to optimize campaign ${campaign.id}:`, error);
      }
    }
  }

  /**
   * Kills underperforming campaigns
   */
  private async pruneLosingCampaigns(): Promise<void> {
    const campaignsToKill = this.agentState.activeCampaigns.filter(campaign => 
      campaign.status === 'active' &&
      campaign.spend >= 50 &&
      campaign.roas < 1.0
    );
    
    for (const campaign of campaignsToKill) {
      try {
        await this.campaignTools.killCampaign({
          campaignId: campaign.id,
          reason: `Poor performance: ROAS ${campaign.roas.toFixed(2)} after $${campaign.spend} spend`
        });
        
        console.log(`💀 Killed losing campaign: ${campaign.platform} - ${campaign.angle}`);
      } catch (error) {
        console.error(`Failed to kill campaign ${campaign.id}:`, error);
      }
    }
  }

  /**
   * Plans activities for the next day
   */
  private async planNextDay(nextDay: number): Promise<void> {
    const plan = [];
    
    // Check if we need new products
    if (this.agentState.activeProducts.length < 3) {
      plan.push('Research new products');
    }
    
    // Check if we need new campaigns
    const activeCampaigns = this.agentState.activeCampaigns.filter(c => c.status === 'active');
    if (activeCampaigns.length < 5 && this.agentState.getAvailableBudget() > 100) {
      plan.push('Launch new campaigns');
    }
    
    // Check for scaling opportunities
    const scalableCampaigns = activeCampaigns.filter(c => c.roas >= 2.0 && c.spend >= 100);
    if (scalableCampaigns.length > 0) {
      plan.push(`Scale ${scalableCampaigns.length} winning campaigns`);
    }
    
    if (plan.length > 0) {
      await this.memory.writeScratchpad(
        `day_${nextDay}_plan`,
        `Tomorrow's priorities: ${plan.join(', ')}`,
        'decision'
      );
    }
  }

  /**
   * Generates daily summary
   */
  private async generateDailySummary(day: number): Promise<string> {
    const metrics = this.dailyMetricsHistory[this.dailyMetricsHistory.length - 1];
    const financialHealth = this.agentState.getFinancialHealth();
    
    return `Day ${day} Summary:
Net Worth: $${metrics.netWorth.toFixed(2)} (${financialHealth.status})
Revenue: $${metrics.revenue.toFixed(2)}
Spend: $${metrics.spend.toFixed(2)}
ROAS: ${metrics.roas.toFixed(2)}
Active Products: ${metrics.activeProducts}
Active Campaigns: ${metrics.activeCampaigns}
Errors: ${metrics.errors}`;
  }

  /**
   * Logs a decision to history
   */
  private logDecision(decision: any, day: number): void {
    const decisionLog: DecisionLog = {
      day,
      context: this.generateDecisionContext(day),
      decision: decision.decision,
      reasoning: decision.reasoning,
      expectedOutcome: decision.expectedOutcome,
      confidence: decision.confidence,
      timestamp: new Date()
    };
    
    this.decisionHistory.push(decisionLog);
  }

  /**
   * Initializes the simulation
   */
  private async initializeSimulation(): Promise<void> {
    console.log('🔧 Initializing simulation systems...');
    
    // Initialize memory with starting context
    await this.memory.writeScratchpad(
      'simulation_start',
      `Simulation started with $${this.config.initialCapital} capital, targeting ${this.config.targetROAS}x ROAS`,
      'insight'
    );
    
    // Add initial system message to context
    this.contextManager.addSystemMessage(
      `Dropshipping simulation started. Initial capital: $${this.config.initialCapital}, Daily ad spend: $${this.config.dailyAdSpend}, Target ROAS: ${this.config.targetROAS}`
    );
    
    console.log('✅ Simulation initialized successfully');
  }

  /**
   * Generates final simulation result
   */
  private async generateSimulationResult(error?: Error): Promise<SimulationResult> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.simulationStartTime.getTime();
    
    const finalMetrics = this.dailyMetricsHistory[this.dailyMetricsHistory.length - 1];
    const bestDay = this.dailyMetricsHistory.reduce((best, current) => 
      current.netWorth > best.netWorth ? current : best
    );
    
    // Find best performing product and campaign
    const bestProduct = this.agentState.activeProducts.reduce((best, current) => {
      const bestAnalysis = best ? best.getAnalysis() : null;
      const currentAnalysis = current.getAnalysis();
      return !bestAnalysis || currentAnalysis.marginAnalysis.marginPercent > bestAnalysis.marginAnalysis.marginPercent 
        ? current : best;
    }, null as any);
    
    const bestCampaign = this.agentState.activeCampaigns.reduce((best, current) => 
      !best || current.roas > best.roas ? current : best
    , null as any);
    
    const worstLoss = Math.min(...this.dailyMetricsHistory.map(m => m.netWorth - this.config.initialCapital));
    const peakNetWorth = Math.max(...this.dailyMetricsHistory.map(m => m.netWorth));
    const avgROAS = this.dailyMetricsHistory.reduce((sum, m) => sum + m.roas, 0) / this.dailyMetricsHistory.length;
    
    const result: SimulationResult = {
      success: !error && !this.agentState.isBankrupt(),
      finalDay: this.lastDayProcessed,
      finalNetWorth: this.agentState.netWorth,
      totalRevenue: this.agentState.totalRevenue,
      totalSpend: this.agentState.totalSpend,
      overallROAS: this.agentState.currentROAS,
      bankruptcyReason: this.agentState.isBankrupt() ? 'Negative balance for 10+ consecutive days' : undefined,
      dailyMetrics: this.dailyMetricsHistory,
      keyDecisions: this.decisionHistory.slice(-20), // Last 20 decisions
      performance: {
        bestProduct,
        bestCampaign,
        worstLosses: worstLoss,
        peakNetWorth,
        averageDailyROAS: avgROAS
      }
    };
    
    // Log final results
    console.log('\n🏁 SIMULATION COMPLETED');
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`Final Day: ${result.finalDay}`);
    console.log(`Final Net Worth: $${result.finalNetWorth.toFixed(2)}`);
    console.log(`Total Revenue: $${result.totalRevenue.toFixed(2)}`);
    console.log(`Total Spend: $${result.totalSpend.toFixed(2)}`);
    console.log(`Overall ROAS: ${result.overallROAS.toFixed(2)}`);
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    
    if (error) {
      console.error('Simulation ended due to error:', error.message);
    }
    
    return result;
  }

  /**
   * Pauses the simulation
   */
  public pause(): void {
    this.isPaused = true;
    console.log('⏸️  Simulation paused');
  }

  /**
   * Resumes the simulation
   */
  public resume(): void {
    this.isPaused = false;
    console.log('▶️  Simulation resumed');
  }

  /**
   * Stops the simulation
   */
  public stop(): void {
    this.isRunning = false;
    console.log('⏹️  Simulation stopped');
  }

  /**
   * Gets current simulation status
   */
  public getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    currentDay: number;
    netWorth: number;
    roas: number;
    activeCampaigns: number;
    activeProducts: number;
  } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      currentDay: this.agentState.currentDay,
      netWorth: this.agentState.netWorth,
      roas: this.agentState.currentROAS,
      activeCampaigns: this.agentState.activeCampaigns.filter(c => c.status === 'active').length,
      activeProducts: this.agentState.activeProducts.filter(p => p.status !== 'killed').length
    };
  }

  /**
   * Waits for simulation to be resumed
   */
  private async waitForResume(): Promise<void> {
    while (this.isPaused && this.isRunning) {
      await this.sleep(1000);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}