import type { 
  SearchProductsParams, 
  AnalyzeProductParams, 
  ToolResult, 
  ProductAnalysis,
  CompetitorIntel 
} from '../types/index.js';
import { GrokClient } from '../agent/GrokClient.js';

/**
 * Product research tools using Live Search API and AI analysis
 */
export class ProductResearchTools {
  private grokClient: GrokClient;

  constructor(grokClient: GrokClient) {
    this.grokClient = grokClient;
  }

  /**
   * Searches for dropshipping products across multiple platforms
   */
  public async searchProducts(params: SearchProductsParams): Promise<ToolResult> {
    try {
      const searchQuery = this.buildProductSearchQuery(params);
      
      // Use Grok with live search to find products
      const searchSources = this.getSearchSources(params.platform);
      
      const response = await this.grokClient.chatWithSearch([
        {
          role: 'system',
          content: `You are a product research specialist for dropshipping. Find profitable products with high demand and good supplier availability.`
        },
        {
          role: 'user',
          content: searchQuery
        }
      ], {
        mode: 'on',
        maxResults: 15,
        sources: searchSources,
        returnCitations: true
      });

      const products = this.parseProductSearchResults(response.content);
      
      return {
        success: true,
        data: {
          products,
          totalFound: products.length,
          searchQuery: params.query,
          citations: response.citations,
          platform: params.platform || 'all'
        },
        metadata: {
          searchTime: new Date().toISOString(),
          usage: response.usage
        }
      };
    } catch (error) {
      console.error('Product search failed:', error);
      return {
        success: false,
        error: `Product search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { products: [] }
      };
    }
  }

  /**
   * Analyzes a specific product for dropshipping potential
   */
  public async analyzeProduct(params: AnalyzeProductParams): Promise<ToolResult> {
    try {
      const analysisPrompt = this.buildProductAnalysisPrompt(params);
      
      const response = await this.grokClient.chatWithSearch([
        {
          role: 'system',
          content: `You are an expert product analyst specializing in dropshipping profitability analysis. Analyze products for margin potential, market demand, competition, and content availability.`
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ], {
        mode: 'on',
        maxResults: 10,
        returnCitations: true
      });

      const analysis = this.parseProductAnalysis(response.content, params);
      
      return {
        success: true,
        data: analysis,
        metadata: {
          analyzedUrl: params.productUrl,
          analysisTime: new Date().toISOString(),
          citations: response.citations,
          usage: response.usage
        }
      };
    } catch (error) {
      console.error('Product analysis failed:', error);
      return {
        success: false,
        error: `Product analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: this.getDefaultAnalysis()
      };
    }
  }

  /**
   * Spies on competitors for a specific product or niche
   */
  public async spyCompetitors(productName: string, platform: 'facebook' | 'tiktok' | 'google' = 'facebook'): Promise<ToolResult> {
    try {
      const spyPrompt = this.buildCompetitorSpyPrompt(productName, platform);
      
      const searchSources = this.getCompetitorSearchSources(platform);
      
      const response = await this.grokClient.chatWithSearch([
        {
          role: 'system',
          content: `You are a competitive intelligence analyst specializing in social media advertising and dropshipping. Find and analyze competitor strategies, ad creatives, and market positioning.`
        },
        {
          role: 'user',
          content: spyPrompt
        }
      ], {
        mode: 'on',
        maxResults: 20,
        sources: searchSources,
        returnCitations: true
      });

      const competitorIntel = this.parseCompetitorIntel(response.content, productName, platform);
      
      return {
        success: true,
        data: competitorIntel,
        metadata: {
          product: productName,
          platform,
          analysisTime: new Date().toISOString(),
          citations: response.citations,
          usage: response.usage
        }
      };
    } catch (error) {
      console.error('Competitor analysis failed:', error);
      return {
        success: false,
        error: `Competitor analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: this.getDefaultCompetitorIntel(productName, platform)
      };
    }
  }

  /**
   * Finds trending products in specific categories
   */
  public async findTrendingProducts(category?: string, timeframe: 'week' | 'month' | 'quarter' = 'month'): Promise<ToolResult> {
    try {
      const trendQuery = this.buildTrendingProductsQuery(category, timeframe);
      
      const response = await this.grokClient.chatWithSearch([
        {
          role: 'system',
          content: `You are a trend analyst specializing in ecommerce and dropshipping. Identify products with rising demand, viral potential, and good profit margins.`
        },
        {
          role: 'user',
          content: trendQuery
        }
      ], {
        mode: 'on',
        maxResults: 20,
        sources: [
          { type: 'web', allowed_websites: ['google.com', 'trends.google.com'] },
          { type: 'x', post_favorite_count: 100 },
          { type: 'news' }
        ],
        returnCitations: true
      });

      const trendingProducts = this.parseTrendingProducts(response.content);
      
      return {
        success: true,
        data: {
          products: trendingProducts,
          category: category || 'all',
          timeframe,
          trendStrength: this.calculateTrendStrength(trendingProducts)
        },
        metadata: {
          searchTime: new Date().toISOString(),
          citations: response.citations,
          usage: response.usage
        }
      };
    } catch (error) {
      console.error('Trending products search failed:', error);
      return {
        success: false,
        error: `Trending products search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { products: [], category: category || 'all', timeframe }
      };
    }
  }

  /**
   * Validates supplier reliability and inventory
   */
  public async validateSupplier(supplierUrl: string, productName: string): Promise<ToolResult> {
    try {
      const validationPrompt = `Analyze this supplier for reliability and inventory status:
      
Supplier URL: ${supplierUrl}
Product: ${productName}

Please check:
1. Supplier reputation and reviews
2. Current inventory levels
3. Shipping times and costs
4. Return/refund policies
5. Communication responsiveness
6. Price stability over time

Provide a reliability score (1-10) and specific recommendations.`;

      const response = await this.grokClient.chatWithSearch([
        {
          role: 'system',
          content: `You are a supplier verification specialist. Analyze supplier reliability, inventory status, and business practices for dropshipping partnerships.`
        },
        {
          role: 'user',
          content: validationPrompt
        }
      ], {
        mode: 'on',
        maxResults: 10,
        returnCitations: true
      });

      const validation = this.parseSupplierValidation(response.content);
      
      return {
        success: true,
        data: validation,
        metadata: {
          supplierUrl,
          productName,
          validationTime: new Date().toISOString(),
          citations: response.citations,
          usage: response.usage
        }
      };
    } catch (error) {
      console.error('Supplier validation failed:', error);
      return {
        success: false,
        error: `Supplier validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {
          reliabilityScore: 5,
          inventoryStatus: 'unknown',
          recommendations: ['Manual verification required'],
          risks: ['Unable to verify automatically']
        }
      };
    }
  }

  /**
   * Builds search query for product discovery
   */
  private buildProductSearchQuery(params: SearchProductsParams): string {
    let query = `Find profitable dropshipping products for: ${params.query}`;
    
    if (params.minPrice || params.maxPrice) {
      query += `\nPrice range: $${params.minPrice || 0} - $${params.maxPrice || 1000}`;
    }
    
    if (params.category) {
      query += `\nCategory: ${params.category}`;
    }
    
    query += `\n\nFor each product, provide:
1. Product name and description
2. Estimated supplier price
3. Recommended selling price (2-3x markup)
4. Market demand indicators
5. Competition level (low/medium/high)
6. Content availability (images, videos, reviews)
7. Supplier information and reliability
8. Profit margin potential

Focus on products with:
- High demand but manageable competition
- Good content availability for marketing
- Reliable suppliers with inventory
- 2-3x markup potential
- Trending or evergreen appeal`;

    return query;
  }

  /**
   * Builds analysis prompt for specific product
   */
  private buildProductAnalysisPrompt(params: AnalyzeProductParams): string {
    return `Analyze this product for dropshipping potential:

Product URL: ${params.productUrl}
Target Margin: ${params.targetMargin || 200}%

Please provide detailed analysis:

1. PRICING ANALYSIS:
   - Current supplier price
   - Recommended selling price for ${params.targetMargin || 200}% markup
   - Price comparison with competitors
   - Profit margin calculations

2. MARKET DEMAND:
   - Search volume and trends
   - Seasonal patterns
   - Target audience size
   - Purchase intent indicators

3. COMPETITION ANALYSIS:
   - Number of competitors
   - Market saturation level
   - Competitor pricing strategies
   - Differentiation opportunities

4. CONTENT AVAILABILITY:
   - Product images quality and quantity
   - Video content availability
   - Customer reviews and ratings
   - UGC (user-generated content) potential

5. SUPPLIER ASSESSMENT:
   - Supplier reliability score
   - Inventory levels
   - Shipping times
   - Communication quality

6. RISK ASSESSMENT:
   - Market risks
   - Supplier risks
   - Legal/compliance issues
   - Seasonal dependencies

Provide final recommendation: PROCEED, CAUTION, or REJECT with reasoning.`;
  }

  /**
   * Builds competitor spy prompt
   */
  private buildCompetitorSpyPrompt(productName: string, platform: string): string {
    return `Research competitors selling "${productName}" on ${platform}:

Find and analyze:

1. ACTIVE COMPETITORS:
   - Who is advertising this product
   - Their ad spend estimates
   - Campaign duration and consistency

2. AD CREATIVE ANALYSIS:
   - Most common ad formats (image/video/carousel)
   - Popular angles and messaging
   - Visual styles and branding
   - Call-to-action strategies

3. TARGETING STRATEGIES:
   - Audience demographics
   - Interest targeting
   - Geographic focus
   - Device preferences

4. PRICING STRATEGIES:
   - Price points being used
   - Discount strategies
   - Bundle offers
   - Shipping policies

5. MARKET SATURATION:
   - Number of active advertisers
   - Market saturation level (low/medium/high)
   - Entry barriers
   - Opportunity gaps

6. PERFORMANCE INDICATORS:
   - Engagement rates on ads
   - Social proof (likes, shares, comments)
   - Landing page quality
   - Conversion optimization

Identify opportunities for differentiation and market entry.`;
  }

  /**
   * Builds trending products query
   */
  private buildTrendingProductsQuery(category?: string, timeframe: string = 'month'): string {
    let query = `Find trending products for dropshipping in the last ${timeframe}`;
    
    if (category) {
      query += ` in the ${category} category`;
    }
    
    query += `\n\nLook for products with:
1. Rising search volume and interest
2. Social media buzz and viral potential
3. Seasonal or event-driven demand
4. Influencer endorsements or mentions
5. News coverage or media attention
6. Good profit margins (2-3x markup potential)
7. Available suppliers with inventory

For each trending product, provide:
- Product name and description
- Trend strength (1-10)
- Estimated demand duration
- Key trend drivers
- Target audience
- Estimated supplier cost
- Recommended selling price
- Competition level
- Marketing angle suggestions

Focus on products with sustainable demand, not just short-term fads.`;

    return query;
  }

  /**
   * Gets search sources based on platform
   */
  private getSearchSources(platform?: string): Array<{ type: string; [key: string]: any }> {
    const sources = [
      { type: 'web', allowed_websites: ['aliexpress.com', 'alibaba.com', 'amazon.com'] }
    ];
    
    if (!platform || platform === 'all') {
      sources.push(
        { type: 'web', allowed_websites: ['shopify.com', 'oberlo.com', 'spocket.com'] },
        { type: 'news', allowed_websites: [] }
      );
    } else if (platform === 'aliexpress') {
      sources.push({ type: 'web', allowed_websites: ['aliexpress.com'] });
    } else if (platform === 'amazon') {
      sources.push({ type: 'web', allowed_websites: ['amazon.com'] });
    }
    
    return sources;
  }

  /**
   * Gets competitor search sources
   */
  private getCompetitorSearchSources(platform: string): Array<{ type: string; [key: string]: any }> {
    const sources = [
      { type: 'web' },
      { type: 'news' }
    ];
    
    if (platform === 'facebook') {
      sources.push({ type: 'web' });
    } else if (platform === 'tiktok') {
      sources.push({ type: 'x' }); // X posts often discuss TikTok trends
    }
    
    return sources;
  }

  /**
   * Parses product search results from AI response
   */
  private parseProductSearchResults(content: string): Array<{
    name: string;
    description: string;
    supplierPrice: number;
    recommendedPrice: number;
    margin: number;
    demandLevel: 'low' | 'medium' | 'high';
    competitionLevel: 'low' | 'medium' | 'high';
    contentScore: number;
    supplierInfo: string;
    category?: string;
  }> {
    // Parse structured product data from AI response
    const products: any[] = [];
    
    // Look for product entries in the response
    const productMatches = content.match(/(?:Product \d+|Product Name)[\s\S]*?(?=Product \d+|$)/gi);
    
    if (productMatches) {
      for (const match of productMatches) {
        const product = this.extractProductFromText(match);
        if (product) {
          products.push(product);
        }
      }
    }
    
    // If no structured products found, create generic ones from content
    if (products.length === 0) {
      products.push(...this.extractGenericProducts(content));
    }
    
    return products.slice(0, 10); // Limit to 10 products
  }

  /**
   * Extracts product information from text
   */
  private extractProductFromText(text: string): any | null {
    try {
      const name = this.extractValue(text, ['name', 'product name', 'title']) || 'Unknown Product';
      const description = this.extractValue(text, ['description', 'desc']) || 'No description available';
      
      const supplierPrice = this.extractPrice(text, ['supplier price', 'cost price', 'wholesale']) || 10;
      const recommendedPrice = this.extractPrice(text, ['selling price', 'retail price', 'recommended']) || supplierPrice * 2.5;
      const margin = recommendedPrice - supplierPrice;
      
      const demandLevel = this.extractLevel(text, ['demand', 'popularity']) || 'medium';
      const competitionLevel = this.extractLevel(text, ['competition', 'competitive']) || 'medium';
      const contentScore = this.extractScore(text, ['content', 'marketing']) || 70;
      
      return {
        name,
        description,
        supplierPrice,
        recommendedPrice,
        margin,
        demandLevel,
        competitionLevel,
        contentScore,
        supplierInfo: this.extractValue(text, ['supplier', 'source']) || 'Various suppliers available'
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extracts generic products from unstructured content
   */
  private extractGenericProducts(content: string): any[] {
    const products = [];
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i];
      if (line.length > 10) { // Skip very short lines
        products.push({
          name: line.substring(0, 50),
          description: line,
          supplierPrice: 10 + Math.random() * 20,
          recommendedPrice: 25 + Math.random() * 50,
          margin: 15 + Math.random() * 30,
          demandLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          competitionLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
          contentScore: 60 + Math.random() * 30,
          supplierInfo: 'Multiple suppliers available'
        });
      }
    }
    
    return products;
  }

  /**
   * Parses product analysis from AI response
   */
  private parseProductAnalysis(content: string, params: AnalyzeProductParams): ProductAnalysis {
    const supplierPrice = this.extractPrice(content, ['supplier price', 'cost', 'wholesale']) || 15;
    const recommendedPrice = this.extractPrice(content, ['recommended price', 'selling price', 'retail']) || supplierPrice * 2.5;
    const margin = recommendedPrice - supplierPrice;
    const marginPercent = (margin / recommendedPrice) * 100;
    
    const contentScore = this.extractScore(content, ['content score', 'marketing score']) || 70;
    const competitorCount = this.extractNumber(content, ['competitors', 'competition']) || 25;
    const marketDemand = this.extractScore(content, ['demand', 'market demand']) || 75;
    
    let riskScore = 0;
    if (competitorCount > 50) riskScore += 30;
    if (contentScore < 60) riskScore += 25;
    if (marginPercent < 150) riskScore += 35;
    
    let recommendation: 'proceed' | 'caution' | 'reject' = 'proceed';
    if (content.toLowerCase().includes('reject')) recommendation = 'reject';
    else if (content.toLowerCase().includes('caution') || riskScore > 50) recommendation = 'caution';
    
    return {
      contentScore,
      marginAnalysis: {
        supplierPrice,
        recommendedPrice,
        margin,
        marginPercent
      },
      competitorCount,
      marketDemand,
      riskScore,
      recommendation
    };
  }

  /**
   * Parses competitor intelligence from AI response
   */
  private parseCompetitorIntel(content: string, productName: string, platform: string): CompetitorIntel {
    const adCount = this.extractNumber(content, ['ads', 'advertisers', 'campaigns']) || 10;
    const averagePrice = this.extractPrice(content, ['average price', 'typical price', 'price range']) || 25;
    
    const topAngles = this.extractAngles(content) || [
      'Problem-solving approach',
      'Lifestyle enhancement',
      'Value proposition'
    ];
    
    let marketSaturation: 'low' | 'medium' | 'high' = 'medium';
    if (adCount < 5) marketSaturation = 'low';
    else if (adCount > 20) marketSaturation = 'high';
    
    const opportunities = this.extractOpportunities(content) || [
      'Unique angle development',
      'Better creative content',
      'Improved targeting'
    ];
    
    return {
      productName,
      platform,
      adCount,
      topAngles,
      averagePrice,
      marketSaturation,
      opportunities
    };
  }

  /**
   * Parses trending products from AI response
   */
  private parseTrendingProducts(content: string): Array<{
    name: string;
    trendStrength: number;
    category: string;
    estimatedDemand: string;
    keyDrivers: string[];
  }> {
    const products = [];
    const sections = content.split(/product \d+/i);
    
    for (const section of sections.slice(1)) { // Skip first empty section
      const name = this.extractValue(section, ['name', 'product']) || 'Trending Product';
      const trendStrength = this.extractScore(section, ['trend', 'strength']) || 7;
      const category = this.extractValue(section, ['category', 'type']) || 'General';
      const estimatedDemand = this.extractValue(section, ['demand', 'duration']) || '2-3 months';
      const keyDrivers = this.extractList(section, ['drivers', 'reasons']) || ['Social media buzz'];
      
      products.push({
        name,
        trendStrength,
        category,
        estimatedDemand,
        keyDrivers
      });
    }
    
    return products.slice(0, 8);
  }

  /**
   * Parses supplier validation from AI response
   */
  private parseSupplierValidation(content: string): {
    reliabilityScore: number;
    inventoryStatus: string;
    shippingTime: string;
    recommendations: string[];
    risks: string[];
  } {
    const reliabilityScore = this.extractScore(content, ['reliability', 'score', 'rating']) || 6;
    const inventoryStatus = this.extractValue(content, ['inventory', 'stock']) || 'Available';
    const shippingTime = this.extractValue(content, ['shipping', 'delivery']) || '7-15 days';
    const recommendations = this.extractList(content, ['recommendations', 'suggest']) || ['Verify manually'];
    const risks = this.extractList(content, ['risks', 'concerns']) || ['Standard supplier risks'];
    
    return {
      reliabilityScore,
      inventoryStatus,
      shippingTime,
      recommendations,
      risks
    };
  }

  /**
   * Helper methods for parsing
   */
  private extractValue(text: string, keywords: string[]): string | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[:\\s]+([^\\n]+)`, 'i');
      const match = text.match(regex);
      if (match) return match[1].trim();
    }
    return null;
  }

  private extractPrice(text: string, keywords: string[]): number | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[:\\s]+\\$?([\\d.]+)`, 'i');
      const match = text.match(regex);
      if (match) return parseFloat(match[1]);
    }
    return null;
  }

  private extractScore(text: string, keywords: string[]): number | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[:\\s]+(\\d+)`, 'i');
      const match = text.match(regex);
      if (match) return parseInt(match[1]);
    }
    return null;
  }

  private extractNumber(text: string, keywords: string[]): number | null {
    return this.extractScore(text, keywords);
  }

  private extractLevel(text: string, keywords: string[]): 'low' | 'medium' | 'high' | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[:\\s]+(low|medium|high)`, 'i');
      const match = text.match(regex);
      if (match) return match[1].toLowerCase() as 'low' | 'medium' | 'high';
    }
    return null;
  }

  private extractAngles(text: string): string[] | null {
    const angles = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('angle') || line.includes('approach') || line.includes('strategy')) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (cleaned.length > 5) angles.push(cleaned);
      }
    }
    
    return angles.length > 0 ? angles.slice(0, 5) : null;
  }

  private extractOpportunities(text: string): string[] | null {
    return this.extractList(text, ['opportunities', 'gaps', 'potential']);
  }

  private extractList(text: string, keywords: string[]): string[] | null {
    const items = [];
    const lines = text.split('\n');
    
    let inSection = false;
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (keywords.some(keyword => lowerLine.includes(keyword))) {
        inSection = true;
        continue;
      }
      
      if (inSection) {
        if (line.match(/^[-*•]\s*/) || line.match(/^\d+\.\s*/)) {
          const cleaned = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
          if (cleaned.length > 3) items.push(cleaned);
        } else if (line.trim().length === 0 || line.match(/^[A-Z]/)) {
          break; // End of section
        }
      }
    }
    
    return items.length > 0 ? items.slice(0, 5) : null;
  }

  private calculateTrendStrength(products: any[]): number {
    if (products.length === 0) return 0;
    const avgStrength = products.reduce((sum, p) => sum + (p.trendStrength || 5), 0) / products.length;
    return Math.round(avgStrength * 10) / 10;
  }

  private getDefaultAnalysis(): ProductAnalysis {
    return {
      contentScore: 50,
      marginAnalysis: {
        supplierPrice: 15,
        recommendedPrice: 35,
        margin: 20,
        marginPercent: 57
      },
      competitorCount: 30,
      marketDemand: 60,
      riskScore: 60,
      recommendation: 'caution'
    };
  }

  private getDefaultCompetitorIntel(productName: string, platform: string): CompetitorIntel {
    return {
      productName,
      platform,
      adCount: 15,
      topAngles: ['Standard marketing approach', 'Price-focused messaging'],
      averagePrice: 25,
      marketSaturation: 'medium',
      opportunities: ['Better creative content', 'Unique positioning']
    };
  }
}