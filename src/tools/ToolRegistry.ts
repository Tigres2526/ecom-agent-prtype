import { z } from 'zod';
import type { Tool, ToolResult } from '../types/index.js';
import { ProductResearchTools } from './ProductResearchTools.js';
import { CampaignManagementTools } from './CampaignManagementTools.js';
import { MarketingAngleTools } from './MarketingAngleTools.js';
import { MemoryTools } from './MemoryTools.js';
import { AnalyticsTools } from './AnalyticsTools.js';
import { OrderTrackingTools } from './OrderTrackingTools.js';
import type { AgentState } from '../models/AgentState.js';
import type { AgentMemory } from '../memory/AgentMemory.js';

/**
 * Tool definition with metadata and execution function
 */
interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (params: any) => Promise<ToolResult>;
  category: 'product' | 'campaign' | 'memory' | 'analytics' | 'order' | 'utility';
}

/**
 * Registry for all available tools in the dropshipping agent system
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private productTools: ProductResearchTools;
  private campaignTools: CampaignManagementTools;
  private marketingTools: MarketingAngleTools;
  private memoryTools: MemoryTools;
  private analyticsTools: AnalyticsTools;
  private orderTools: OrderTrackingTools;

  constructor(
    productTools: ProductResearchTools,
    campaignTools: CampaignManagementTools,
    marketingTools: MarketingAngleTools,
    memoryTools: MemoryTools,
    analyticsTools: AnalyticsTools,
    orderTools: OrderTrackingTools
  ) {
    this.productTools = productTools;
    this.campaignTools = campaignTools;
    this.marketingTools = marketingTools;
    this.memoryTools = memoryTools;
    this.analyticsTools = analyticsTools;
    this.orderTools = orderTools;
    
    this.registerAllTools();
  }

  /**
   * Registers all available tools
   */
  private registerAllTools(): void {
    // Product Research Tools
    this.registerTool({
      name: 'search_products',
      description: 'Search for potential dropshipping products across multiple platforms',
      parameters: z.object({
        query: z.string().describe('Search query for products'),
        platform: z.enum(['amazon', 'aliexpress', 'temu', 'all']).default('all'),
        minMargin: z.number().optional().describe('Minimum profit margin percentage'),
        maxPrice: z.number().optional().describe('Maximum supplier price'),
      }),
      execute: async (params) => this.productTools.searchProducts(params),
      category: 'product',
    });

    this.registerTool({
      name: 'analyze_product',
      description: 'Analyze a specific product for dropshipping viability',
      parameters: z.object({
        productUrl: z.string().url().describe('URL of the product to analyze'),
        competitorData: z.any().optional().describe('Optional competitor data'),
      }),
      execute: async (params) => this.productTools.analyzeProduct(params),
      category: 'product',
    });

    this.registerTool({
      name: 'spy_competitors',
      description: 'Analyze competitor advertising strategies and performance',
      parameters: z.object({
        product: z.any().describe('Product to find competitors for'),
        platforms: z.array(z.enum(['facebook', 'tiktok', 'google'])).default(['facebook', 'tiktok']),
      }),
      execute: async (params) => this.productTools.spyCompetitors(
        params.product,
        params.platforms
      ),
      category: 'product',
    });

    // Campaign Management Tools
    this.registerTool({
      name: 'create_campaign',
      description: 'Create a new advertising campaign',
      parameters: z.object({
        product: z.any().describe('Product to advertise'),
        platform: z.enum(['facebook', 'tiktok', 'google']).describe('Advertising platform'),
        budget: z.number().describe('Daily budget for the campaign'),
        angle: z.string().describe('Marketing angle for the campaign'),
        audience: z.any().optional().describe('Target audience configuration'),
      }),
      execute: async (params) => this.campaignTools.createCampaign(params),
      category: 'campaign',
    });

    this.registerTool({
      name: 'check_metrics',
      description: 'Check performance metrics for all active campaigns',
      parameters: z.object({
        timeframe: z.enum(['today', 'yesterday', 'last7days', 'last30days']).default('today'),
      }),
      execute: async (params) => this.campaignTools.checkMetrics(),
      category: 'campaign',
    });

    this.registerTool({
      name: 'scale_campaign',
      description: 'Scale a successful campaign by increasing budget',
      parameters: z.object({
        campaignId: z.string().describe('ID of the campaign to scale'),
        newBudget: z.number().describe('New daily budget'),
        reason: z.string().optional().describe('Reason for scaling'),
      }),
      execute: async (params) => this.campaignTools.scaleCampaign(params),
      category: 'campaign',
    });

    this.registerTool({
      name: 'kill_campaign',
      description: 'Stop an underperforming campaign',
      parameters: z.object({
        campaignId: z.string().describe('ID of the campaign to stop'),
        reason: z.string().describe('Reason for stopping the campaign'),
      }),
      execute: async (params) => this.campaignTools.killCampaign(params),
      category: 'campaign',
    });

    // Marketing Angle Tools
    this.registerTool({
      name: 'generate_angles',
      description: 'Generate creative marketing angles for a product',
      parameters: z.object({
        product: z.any().describe('Product to generate angles for'),
        competitorIntel: z.any().optional().describe('Competitor intelligence data'),
        existingAngles: z.array(z.string()).optional().describe('Angles already tested'),
        count: z.number().min(1).max(10).default(5).describe('Number of angles to generate'),
      }),
      execute: async (params) => this.marketingTools.generateAngles(params),
      category: 'campaign',
    });

    this.registerTool({
      name: 'test_angles',
      description: 'Test marketing angles through A/B testing',
      parameters: z.object({
        angles: z.array(z.string()).describe('Marketing angles to test'),
        product: z.any().describe('Product being advertised'),
        budget: z.number().describe('Test budget per angle'),
        platform: z.enum(['facebook', 'tiktok', 'google']).describe('Platform for testing'),
      }),
      execute: async (params) => this.marketingTools.testAngles(
        params.angles,
        params.budget,
        7 // default duration of 7 days
      ),
      category: 'campaign',
    });

    // Memory Tools
    this.registerTool({
      name: 'remember',
      description: 'Store important information in long-term memory',
      parameters: z.object({
        key: z.string().describe('Key for the memory'),
        value: z.any().describe('Value to remember'),
        category: z.enum(['decision', 'metric', 'insight', 'error']),
      }),
      execute: async (params) => this.memoryTools.remember(
        params.key,
        params.value,
        params.category
      ),
      category: 'memory',
    });

    this.registerTool({
      name: 'recall',
      description: 'Retrieve information from long-term memory',
      parameters: z.object({
        query: z.string().describe('Search query for memory retrieval'),
        category: z.enum(['decision', 'metric', 'insight', 'error']).optional(),
        limit: z.number().min(1).max(10).default(5),
      }),
      execute: async (params) => this.memoryTools.recall(
        params.query,
        params.category,
        params.limit
      ),
      category: 'memory',
    });

    this.registerTool({
      name: 'write_scratchpad',
      description: 'Write temporary notes to scratchpad',
      parameters: z.object({
        note: z.string().describe('Note to write'),
        category: z.string().optional().describe('Category for the note'),
      }),
      execute: async (params) => this.memoryTools.writeScratchpad(
        params.note,
        params.category
      ),
      category: 'memory',
    });

    // Analytics Tools
    this.registerTool({
      name: 'analyze_performance',
      description: 'Analyze overall business performance',
      parameters: z.object({
        timeframe: z.enum(['today', 'yesterday', 'last7days', 'last30days', 'all']).default('last7days'),
        metrics: z.array(z.enum(['revenue', 'spend', 'roas', 'profit', 'conversion'])).optional(),
      }),
      execute: async (params) => this.analyticsTools.analyzePerformance(
        params.timeframe,
        params.metrics
      ),
      category: 'analytics',
    });

    this.registerTool({
      name: 'generate_report',
      description: 'Generate a comprehensive business report',
      parameters: z.object({
        type: z.enum(['daily', 'weekly', 'monthly', 'custom']),
        startDate: z.string().optional().describe('Start date for custom reports'),
        endDate: z.string().optional().describe('End date for custom reports'),
      }),
      execute: async (params) => this.analyticsTools.generateReport(
        params.type,
        params.startDate,
        params.endDate
      ),
      category: 'analytics',
    });

    // Order Tracking Tools
    this.registerTool({
      name: 'create_order',
      description: 'Create a new order with a supplier',
      parameters: z.object({
        customerId: z.string(),
        productId: z.string(),
        supplierId: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        shippingAddress: z.object({
          street: z.string(),
          city: z.string(),
          state: z.string(),
          zipCode: z.string(),
          country: z.string(),
        }),
      }),
      execute: async (params) => {
        const tools = this.orderTools.getTools();
        const tool = tools.find(t => t.function.name === 'create_order');
        if (!tool) return { success: false, error: 'Tool not found' };
        return await this.orderTools.createOrder(params);
      },
      category: 'order',
    });

    this.registerTool({
      name: 'update_order_status',
      description: 'Update the status of an existing order',
      parameters: z.object({
        orderId: z.string(),
        status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
        trackingNumber: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (params) => {
        const tools = this.orderTools.getTools();
        const tool = tools.find(t => t.function.name === 'update_order_status');
        if (!tool) return { success: false, error: 'Tool not found' };
        return await this.orderTools.updateOrderStatus(params);
      },
      category: 'order',
    });

    this.registerTool({
      name: 'get_order_status',
      description: 'Get the current status and details of an order',
      parameters: z.object({
        orderId: z.string(),
      }),
      execute: async (params) => {
        const tools = this.orderTools.getTools();
        const tool = tools.find(t => t.function.name === 'get_order_status');
        if (!tool) return { success: false, error: 'Tool not found' };
        return await this.orderTools.getOrderStatus(params);
      },
      category: 'order',
    });

    this.registerTool({
      name: 'track_shipment',
      description: 'Track a shipment using the tracking number',
      parameters: z.object({
        trackingNumber: z.string(),
      }),
      execute: async (params) => {
        const tools = this.orderTools.getTools();
        const tool = tools.find(t => t.function.name === 'track_shipment');
        if (!tool) return { success: false, error: 'Tool not found' };
        return await this.orderTools.trackShipment(params);
      },
      category: 'order',
    });

    this.registerTool({
      name: 'get_supplier_performance',
      description: 'Get performance metrics for a supplier',
      parameters: z.object({
        supplierId: z.string(),
        dateRange: z.object({
          start: z.string(),
          end: z.string(),
        }).optional(),
      }),
      execute: async (params) => {
        const tools = this.orderTools.getTools();
        const tool = tools.find(t => t.function.name === 'get_supplier_performance');
        if (!tool) return { success: false, error: 'Tool not found' };
        return await this.orderTools.getSupplierPerformance(params);
      },
      category: 'order',
    });

    this.registerTool({
      name: 'bulk_order_status',
      description: 'Get status of multiple orders at once',
      parameters: z.object({
        orderIds: z.array(z.string()),
      }),
      execute: async (params) => {
        const tools = this.orderTools.getTools();
        const tool = tools.find(t => t.function.name === 'bulk_order_status');
        if (!tool) return { success: false, error: 'Tool not found' };
        return await this.orderTools.bulkOrderStatus(params);
      },
      category: 'order',
    });
  }

  /**
   * Registers a single tool
   */
  private registerTool(definition: ToolDefinition): void {
    this.tools.set(definition.name, definition);
  }

  /**
   * Gets a tool by name
   */
  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Gets all available tools
   */
  public getAllTools(): Tool[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: this.zodToJsonSchema(tool.parameters),
      },
    }));
  }

  /**
   * Gets tools by category
   */
  public getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.values())
      .filter(tool => tool.category === category)
      .map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: this.zodToJsonSchema(tool.parameters),
        },
      }));
  }

  /**
   * Executes a tool with validation
   */
  public async executeTool(name: string, parameters: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
      };
    }

    try {
      // Validate parameters
      const validatedParams = tool.parameters.parse(parameters);
      
      // Execute tool
      const result = await tool.execute(validatedParams);
      
      // Log tool execution
      console.log(`✅ Executed tool: ${name}`, {
        parameters: validatedParams,
        success: result.success,
      });
      
      return result;
    } catch (error) {
      console.error(`❌ Tool execution failed: ${name}`, error);
      
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Invalid parameters: ${error.errors.map(e => e.message).join(', ')}`,
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Converts Zod schema to JSON Schema for tool definitions
   */
  private zodToJsonSchema(schema: z.ZodType<any>): any {
    // Simplified conversion - in production, use a proper library
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: any = {};
      const required: string[] = [];
      
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodTypeToJsonSchema(value as z.ZodType<any>);
        
        // Check if field is required
        if (!(value instanceof z.ZodOptional)) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
    
    return { type: 'object' };
  }

  /**
   * Converts individual Zod types to JSON Schema
   */
  private zodTypeToJsonSchema(type: z.ZodType<any>): any {
    if (type instanceof z.ZodString) {
      return { type: 'string' };
    } else if (type instanceof z.ZodNumber) {
      return { type: 'number' };
    } else if (type instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    } else if (type instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodTypeToJsonSchema(type.element),
      };
    } else if (type instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: type.options,
      };
    } else if (type instanceof z.ZodOptional) {
      return this.zodTypeToJsonSchema(type.unwrap());
    } else if (type instanceof z.ZodDefault) {
      const schema = this.zodTypeToJsonSchema(type.removeDefault());
      schema.default = type._def.defaultValue();
      return schema;
    }
    
    return { type: 'any' };
  }
}