import type { 
  ToolCall, 
  DecisionLog,
  AgentConfig 
} from '../types/index.js';
import { AgentState } from '../models/AgentState.js';
import { Product } from '../models/Product.js';
import { Campaign } from '../models/Campaign.js';
import { GrokClient } from './GrokClient.js';
import { ContextManager } from './ContextManager.js';

/**
 * AI-powered decision engine using Grok-4 with structured prompts
 */
export class DecisionEngine {
  private grokClient: GrokClient;
  private contextManager: ContextManager;
  private config: AgentConfig;

  constructor(
    grokClient: GrokClient,
    contextManager: ContextManager,
    config: AgentConfig
  ) {
    this.grokClient = grokClient;
    this.contextManager = contextManager;
    this.config = config;
  }

  /**
   * Makes a strategic decision based on current agent state
   */
  public async makeDecision(
    agentState: AgentState,
    availableTools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: Record<string, any>;
      };
    }>,
    context?: string
  ): Promise<{
    decision: string;
    reasoning: string;
    toolCalls?: ToolCall[];
    confidence: number;
    expectedOutcome: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const systemPrompt = this.generateSystemPrompt(agentState);
    const situationAnalysis = this.generateSituationAnalysis(agentState, context);
    
    // Add context to conversation
    this.contextManager.addSystemMessage(systemPrompt);
    this.contextManager.addUserMessage(situationAnalysis);
    
    const messages = this.contextManager.getMessagesForGrok();
    
    try {
      const response = await this.grokClient.chatCompletion(messages, {
        tools: availableTools,
        temperature: 0.3, // Lower temperature for more consistent decisions
        maxTokens: 2000,
      });
      
      // Parse the decision from the response
      const decision = this.parseDecisionResponse(response.content, response.toolCalls);
      
      // Add assistant response to context
      this.contextManager.addAssistantMessage(response.content, response.toolCalls);
      
      return decision;
    } catch (error) {
      console.error('Decision making failed:', error);
      
      // Fallback to conservative decision
      return this.makeConservativeDecision(agentState);
    }
  }

  /**
   * Generates the system prompt based on current agent state
   */
  private generateSystemPrompt(agentState: AgentState): string {
    const financialHealth = agentState.getFinancialHealth();
    
    return `You are an autonomous dropshipping brand manager with advanced business intelligence.

CURRENT STATUS:
- Day: ${agentState.currentDay}
- Net Worth: $${agentState.netWorth.toFixed(2)}
- Daily Ad Spend: $${agentState.dailyFee}
- Active Products: ${agentState.activeProducts.length}
- Active Campaigns: ${agentState.activeCampaigns.length}
- Current ROAS: ${agentState.currentROAS.toFixed(2)}
- Financial Health: ${financialHealth.status}
- Days Until Bankruptcy: ${financialHealth.daysUntilBankruptcy || 'N/A'}

CORE RESPONSIBILITIES:
1. Product Selection: Find products with 2-3x markup potential and high content scores
2. Offer Creation: Design irresistible cold traffic offers that convert
3. Angle Marketing: Discover untapped mini-niches through scientific creative processes
4. Campaign Management: Optimize TOF/MOF/BOF funnels across platforms
5. Scaling Decisions: Scale winners aggressively, kill losers quickly

CRITICAL RULES:
- Maintain breakeven ROAS of at least 1.5-1.7 (current target: ${this.config.targetROAS})
- NEVER exceed available capital: $${agentState.getAvailableBudget().toFixed(2)}
- Test at least 3 angles before killing a product
- Document ALL decisions in memory with reasoning
- Verify supplier inventory before scaling campaigns
- Kill campaigns immediately if ROAS < 1.0 after $50+ spend
- Enter conservative mode if net worth drops below 50% of initial capital

FINANCIAL CONSTRAINTS:
- Available Budget: $${agentState.getAvailableBudget().toFixed(2)}
- Bankruptcy Risk: ${agentState.bankruptcyDays > 0 ? 'HIGH' : 'LOW'}
- Error Count: ${agentState.errorCount}/10 (recovery mode at 10)

DECISION FRAMEWORK:
1. Analyze current financial position and risks
2. Evaluate active campaigns and products performance
3. Identify highest-impact opportunities
4. Choose actions that maximize expected value
5. Always provide reasoning and expected outcomes
6. Assign confidence level (0.0-1.0) to decisions

Your responses must be strategic, data-driven, and focused on profitability. Think step-by-step and explain your reasoning clearly.`;
  }

  /**
   * Generates situation analysis for decision making
   */
  private generateSituationAnalysis(agentState: AgentState, context?: string): string {
    const campaignSummary = this.summarizeCampaigns(agentState.activeCampaigns);
    const productSummary = this.summarizeProducts(agentState.activeProducts);
    
    return `SITUATION ANALYSIS:

FINANCIAL POSITION:
- Current net worth: $${agentState.netWorth.toFixed(2)}
- Total revenue: $${agentState.totalRevenue.toFixed(2)}
- Total spend: $${agentState.totalSpend.toFixed(2)}
- Overall ROAS: ${agentState.currentROAS.toFixed(2)}

ACTIVE CAMPAIGNS:
${campaignSummary}

ACTIVE PRODUCTS:
${productSummary}

RECENT CONTEXT:
${context || 'No additional context provided'}

DECISION REQUEST:
Based on the current situation, what should be the next strategic action? Consider:
1. Should we launch new products or focus on existing ones?
2. Which campaigns need optimization, scaling, or killing?
3. Are there any urgent financial risks to address?
4. What tools should be used to execute the decision?

Provide a clear decision with reasoning, expected outcome, and confidence level.`;
  }

  /**
   * Summarizes active campaigns for decision context
   */
  private summarizeCampaigns(campaigns: Campaign[]): string {
    if (campaigns.length === 0) {
      return 'No active campaigns';
    }

    const summaries = campaigns.map(campaign => {
      const performance = campaign.getPerformanceSummary();
      return `- ${campaign.platform} campaign (${campaign.angle}): $${campaign.spend}/$${campaign.budget} spent, ROAS ${campaign.roas.toFixed(2)}, ${performance.efficiency}`;
    });

    return summaries.join('\n');
  }

  /**
   * Summarizes active products for decision context
   */
  private summarizeProducts(products: Product[]): string {
    if (products.length === 0) {
      return 'No active products';
    }

    const summaries = products.map(product => {
      const analysis = product.getAnalysis();
      return `- ${product.name}: ${product.status}, margin ${product.getMarginPercentage().toFixed(1)}%, content score ${product.contentScore}, ${analysis.recommendation}`;
    });

    return summaries.join('\n');
  }

  /**
   * Parses the decision response from Grok
   */
  private parseDecisionResponse(
    content: string,
    toolCalls?: ToolCall[]
  ): {
    decision: string;
    reasoning: string;
    toolCalls?: ToolCall[];
    confidence: number;
    expectedOutcome: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  } {
    // Extract structured information from the response
    const decision = this.extractSection(content, 'DECISION') || content.split('\n')[0] || 'Continue monitoring';
    const reasoning = this.extractSection(content, 'REASONING') || this.extractSection(content, 'ANALYSIS') || 'Standard operational decision';
    const expectedOutcome = this.extractSection(content, 'EXPECTED OUTCOME') || this.extractSection(content, 'OUTCOME') || 'Maintain current performance';
    
    // Extract confidence (look for patterns like "confidence: 0.8" or "80% confident")
    let confidence = 0.7; // default
    const confidenceMatch = content.match(/confidence[:\s]+(\d*\.?\d+)/i) || content.match(/(\d+)%\s*confident/i);
    if (confidenceMatch) {
      const value = parseFloat(confidenceMatch[1]);
      confidence = value > 1 ? value / 100 : value;
    }

    // Determine urgency based on keywords and context
    const urgency = this.determineUrgency(content, decision);

    return {
      decision,
      reasoning,
      toolCalls,
      confidence: Math.max(0, Math.min(1, confidence)),
      expectedOutcome,
      urgency,
    };
  }

  /**
   * Extracts a section from structured response
   */
  private extractSection(content: string, sectionName: string): string | null {
    const regex = new RegExp(`${sectionName}[:\\s]*([^\\n]+(?:\\n(?![A-Z][A-Z\\s]*:)[^\\n]+)*)`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Determines urgency level based on content analysis
   */
  private determineUrgency(content: string, decision: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalKeywords = ['bankrupt', 'emergency', 'critical', 'urgent', 'immediate'];
    const highKeywords = ['kill campaign', 'stop', 'pause', 'risk', 'losing', 'high priority'];
    const mediumKeywords = ['scale', 'optimize', 'adjust', 'modify', 'launch', 'research', 'new product'];
    
    const lowerContent = content.toLowerCase();
    const lowerDecision = decision.toLowerCase();
    
    if (criticalKeywords.some(keyword => lowerContent.includes(keyword) || lowerDecision.includes(keyword))) {
      return 'critical';
    }
    
    if (highKeywords.some(keyword => lowerContent.includes(keyword) || lowerDecision.includes(keyword))) {
      return 'high';
    }
    
    if (mediumKeywords.some(keyword => lowerContent.includes(keyword) || lowerDecision.includes(keyword))) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Makes a conservative fallback decision when AI fails
   */
  private makeConservativeDecision(agentState: AgentState): {
    decision: string;
    reasoning: string;
    confidence: number;
    expectedOutcome: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  } {
    const financialHealth = agentState.getFinancialHealth();
    
    if (financialHealth.status === 'critical' || agentState.isBankrupt()) {
      return {
        decision: 'Enter emergency conservation mode - kill all losing campaigns',
        reasoning: 'AI decision engine failed and financial situation is critical',
        confidence: 0.9,
        expectedOutcome: 'Prevent further losses and preserve remaining capital',
        urgency: 'critical',
      };
    }
    
    if (agentState.hasExcessiveErrors()) {
      return {
        decision: 'Enter recovery mode - pause all new activities',
        reasoning: 'AI decision engine failed and error count is high',
        confidence: 0.8,
        expectedOutcome: 'Stabilize operations and reduce error rate',
        urgency: 'high',
      };
    }
    
    return {
      decision: 'Continue monitoring current operations',
      reasoning: 'AI decision engine failed, maintaining status quo as safe fallback',
      confidence: 0.6,
      expectedOutcome: 'Maintain current performance until AI is restored',
      urgency: 'medium',
    };
  }

  /**
   * Analyzes a specific situation with focused prompting
   */
  public async analyzeSpecificSituation(
    situation: string,
    agentState: AgentState,
    options: {
      useSearch?: boolean;
      focusArea?: 'financial' | 'product' | 'campaign' | 'market';
      urgency?: 'low' | 'medium' | 'high' | 'critical';
    } = {}
  ): Promise<{
    analysis: string;
    recommendations: string[];
    risks: string[];
    opportunities: string[];
  }> {
    const focusPrompt = this.generateFocusPrompt(options.focusArea, agentState);
    const analysisPrompt = `${focusPrompt}

SITUATION TO ANALYZE:
${situation}

Please provide:
1. ANALYSIS: Detailed analysis of the situation
2. RECOMMENDATIONS: 3-5 specific actionable recommendations
3. RISKS: Key risks to be aware of
4. OPPORTUNITIES: Potential opportunities to capitalize on

Be specific and actionable in your response.`;

    try {
      const response = options.useSearch 
        ? await this.grokClient.chatWithSearch([
            { role: 'system', content: focusPrompt },
            { role: 'user', content: analysisPrompt }
          ])
        : await this.grokClient.simpleChat(focusPrompt, analysisPrompt);

      return this.parseAnalysisResponse(typeof response === 'string' ? response : response.content);
    } catch (error) {
      console.error('Situation analysis failed:', error);
      return {
        analysis: 'Analysis failed due to technical error',
        recommendations: ['Monitor situation closely', 'Proceed with caution'],
        risks: ['Technical analysis unavailable'],
        opportunities: ['Manual analysis required'],
      };
    }
  }

  /**
   * Generates focused prompt for specific analysis areas
   */
  private generateFocusPrompt(focusArea: string | undefined, agentState: AgentState): string {
    const basePrompt = `You are an expert dropshipping business analyst.`;
    
    switch (focusArea) {
      case 'financial':
        return `${basePrompt} Focus on financial analysis, cash flow, profitability, and risk management. Current net worth: $${agentState.netWorth}, ROAS: ${agentState.currentROAS}.`;
      
      case 'product':
        return `${basePrompt} Focus on product analysis, market fit, competition, and sourcing. Active products: ${agentState.activeProducts.length}.`;
      
      case 'campaign':
        return `${basePrompt} Focus on advertising campaign performance, optimization, and scaling. Active campaigns: ${agentState.activeCampaigns.length}.`;
      
      case 'market':
        return `${basePrompt} Focus on market trends, opportunities, and competitive landscape analysis.`;
      
      default:
        return `${basePrompt} Provide comprehensive business analysis covering all aspects.`;
    }
  }

  /**
   * Parses analysis response into structured format
   */
  private parseAnalysisResponse(content: string): {
    analysis: string;
    recommendations: string[];
    risks: string[];
    opportunities: string[];
  } {
    const analysis = this.extractSection(content, 'ANALYSIS') || content.split('\n')[0] || 'No analysis available';
    
    const recommendations = this.extractListSection(content, 'RECOMMENDATIONS') || ['No specific recommendations'];
    const risks = this.extractListSection(content, 'RISKS') || ['No specific risks identified'];
    const opportunities = this.extractListSection(content, 'OPPORTUNITIES') || ['No specific opportunities identified'];
    
    return {
      analysis,
      recommendations,
      risks,
      opportunities,
    };
  }

  /**
   * Extracts list items from a section
   */
  private extractListSection(content: string, sectionName: string): string[] | null {
    const section = this.extractSection(content, sectionName);
    if (!section) return null;
    
    // Split by lines and clean up list items
    return section
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, ''))
      .filter(line => line.length > 0);
  }

  /**
   * Creates a decision log entry
   */
  public createDecisionLog(
    decision: {
      decision: string;
      reasoning: string;
      confidence: number;
      expectedOutcome: string;
      urgency: 'low' | 'medium' | 'high' | 'critical';
    },
    agentState: AgentState,
    context?: string
  ): DecisionLog {
    return {
      day: agentState.currentDay,
      context: context || 'Standard decision cycle',
      decision: decision.decision,
      reasoning: decision.reasoning,
      expectedOutcome: decision.expectedOutcome,
      confidence: decision.confidence,
      timestamp: new Date(),
    };
  }
}