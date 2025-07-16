// Core data model interfaces for the Dropshipping AI Agent

export interface AgentConfig {
  initialCapital: number;
  dailyAdSpend: number;
  targetROAS: number;
  maxDays: number;
  maxContextTokens: number;
  maxActionsPerDay: number;
  bankruptcyThreshold: number; // days of negative balance
}

export interface AgentState {
  currentDay: number;
  netWorth: number;
  dailyFee: number;
  activeProducts: Product[];
  activeCampaigns: Campaign[];
  currentROAS: number;
  bankruptcyDays: number;
  errorCount: number;
  totalRevenue: number;
  totalSpend: number;
}

export interface Product {
  id: string;
  name: string;
  sourceUrl: string;
  supplierPrice: number;
  recommendedPrice: number;
  margin: number;
  contentScore: number;
  competitorCount: number;
  status: 'researching' | 'testing' | 'scaling' | 'killed';
  createdDay: number;
  description?: string;
  category?: string;
  tags?: string[];
}

export interface Campaign {
  id: string;
  productId: string;
  platform: 'facebook' | 'tiktok' | 'google';
  angle: string;
  budget: number;
  spend: number;
  revenue: number;
  roas: number;
  status: 'active' | 'paused' | 'killed';
  createdDay: number;
  lastOptimized: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
}

export interface MemoryEntry {
  key: string;
  value: string;
  timestamp: Date;
  day: number;
  type: 'decision' | 'metric' | 'insight' | 'error';
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface DecisionLog {
  day: number;
  context: string;
  decision: string;
  reasoning: string;
  expectedOutcome: string;
  confidence: number;
  actualOutcome?: string;
  success?: boolean;
  timestamp: Date;
}

export interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ProductAnalysis {
  contentScore: number;
  marginAnalysis: {
    supplierPrice: number;
    recommendedPrice: number;
    margin: number;
    marginPercent: number;
  };
  competitorCount: number;
  marketDemand: number;
  riskScore: number;
  recommendation: 'proceed' | 'caution' | 'reject';
}

export interface MarketingAngle {
  id: string;
  productId: string;
  angle: string;
  targetAudience: string;
  painPoint: string;
  solution: string;
  hook: string;
  cta: string;
  confidence: number;
  tested: boolean;
  performance?: {
    ctr: number;
    conversionRate: number;
    roas: number;
  };
}

export interface CompetitorIntel {
  productName: string;
  platform: string;
  adCount: number;
  topAngles: string[];
  averagePrice: number;
  marketSaturation: 'low' | 'medium' | 'high';
  opportunities: string[];
}

export interface DailyMetrics {
  day: number;
  netWorth: number;
  revenue: number;
  spend: number;
  roas: number;
  activeProducts: number;
  activeCampaigns: number;
  newProducts: number;
  killedCampaigns: number;
  scaledCampaigns: number;
  errors: number;
}

export interface SimulationResult {
  success: boolean;
  finalDay: number;
  finalNetWorth: number;
  totalRevenue: number;
  totalSpend: number;
  overallROAS: number;
  bankruptcyReason?: string;
  dailyMetrics: DailyMetrics[];
  keyDecisions: DecisionLog[];
  performance: {
    bestProduct?: Product;
    bestCampaign?: Campaign;
    worstLosses: number;
    peakNetWorth: number;
    averageDailyROAS: number;
  };
}

// Tool-specific interfaces
export interface SearchProductsParams {
  query: string;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  platform?: 'aliexpress' | 'amazon' | 'all';
}

export interface AnalyzeProductParams {
  productUrl: string;
  targetMargin?: number;
}

export interface CreateCampaignParams {
  product: Product;
  angle: MarketingAngle;
  budget: number;
  platform: 'facebook' | 'tiktok' | 'google';
  audience?: Record<string, any>;
}

export interface ScaleCampaignParams {
  campaignId: string;
  newBudget: number;
  reason: string;
}

export interface KillCampaignParams {
  campaignId: string;
  reason: string;
}

// Context and Memory interfaces
export interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: Date;
  tokens: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  similarity: number;
  relevance: number;
}

// Error and Recovery interfaces
export interface ErrorContext {
  type: 'api' | 'financial' | 'product' | 'campaign' | 'memory' | 'system';
  message: string;
  stack?: string;
  context: Record<string, any>;
  timestamp: Date;
  day: number;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'conservative' | 'reset' | 'abort';
  description: string;
  parameters?: Record<string, any>;
}

// Metrics types
export type MetricType = 
  | 'net_worth'
  | 'total_revenue'
  | 'total_spend'
  | 'current_roas'
  | 'active_campaigns'
  | 'active_products'
  | 'error_count'
  | 'campaign_revenue'
  | 'campaign_spend'
  | 'campaign_conversions'
  | 'product_sales'
  | 'product_revenue'
  | 'decision_confidence'
  | 'decision_time';

export interface MetricSnapshot {
  type: MetricType;
  value: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceReport {
  summary: {
    currentDay: number;
    netWorth: number;
    totalRevenue: number;
    totalSpend: number;
    overallROAS: number;
    activeCampaigns: number;
    activeProducts: number;
  };
  trends: {
    netWorth: MetricTrend;
    roas: MetricTrend;
    revenue: MetricTrend;
    errors: MetricTrend;
  };
  topPerformers: {
    campaigns: Array<{ id: string; avgRevenue: number }>;
    products: Array<{ id: string; revenue: number }>;
  };
  alerts: string[];
}

export interface MetricTrend {
  current: number;
  previous: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

// Tool system interfaces
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any; // JSON Schema format
  };
}

export type AgentTool = Tool;
export type CampaignData = Campaign;