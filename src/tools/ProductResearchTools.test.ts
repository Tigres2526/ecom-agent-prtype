import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductResearchTools } from './ProductResearchTools.js';
import { GrokClient } from '../agent/GrokClient.js';

// Mock the GrokClient
vi.mock('../agent/GrokClient.js', () => ({
  GrokClient: vi.fn().mockImplementation(() => ({
    chatWithSearch: vi.fn(),
  })),
}));

describe('ProductResearchTools', () => {
  let productTools: ProductResearchTools;
  let mockGrokClient: any;

  beforeEach(() => {
    mockGrokClient = new GrokClient();
    productTools = new ProductResearchTools(mockGrokClient);
  });

  describe('searchProducts', () => {
    it('should search for products successfully', async () => {
      const mockResponse = {
        content: `Product 1:
Product Name: Wireless Phone Charger
Description: Fast wireless charging pad for smartphones
Supplier Price: $8
Selling Price: $25
Recommended: $25
Demand: High
Competition: Medium
Content Score: 85

Product 2:
Product Name: Bluetooth Earbuds
Description: True wireless earbuds with noise cancellation
Supplier Price: $12
Recommended Price: $35
Demand: High
Competition: High
Content Score: 90`,
        citations: ['https://aliexpress.com/item1', 'https://amazon.com/item2'],
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const params = {
        query: 'phone accessories',
        minPrice: 5,
        maxPrice: 50,
        category: 'electronics'
      };

      const result = await productTools.searchProducts(params);

      expect(result.success).toBe(true);
      expect(result.data.products).toHaveLength(2);
      expect(result.data.products[0].name).toContain('Wireless Phone Charger');
      expect(result.data.products[0].supplierPrice).toBe(8);
      expect(result.data.products[0].recommendedPrice).toBe(25);
      expect(result.data.citations).toEqual(['https://aliexpress.com/item1', 'https://amazon.com/item2']);
      expect(result.metadata.usage).toBeDefined();
    });

    it('should handle search failures gracefully', async () => {
      mockGrokClient.chatWithSearch.mockRejectedValueOnce(new Error('API Error'));

      const result = await productTools.searchProducts({ query: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Product search failed');
      expect(result.data.products).toEqual([]);
    });

    it('should build correct search query with all parameters', async () => {
      mockGrokClient.chatWithSearch.mockResolvedValueOnce({
        content: 'No products found',
        citations: [],
        usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 }
      });

      const params = {
        query: 'fitness equipment',
        minPrice: 20,
        maxPrice: 100,
        category: 'fitness',
        platform: 'aliexpress' as const
      };

      await productTools.searchProducts(params);

      expect(mockGrokClient.chatWithSearch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('fitness equipment')
          })
        ]),
        expect.objectContaining({
          mode: 'on',
          maxResults: 15,
          sources: expect.arrayContaining([
            expect.objectContaining({ type: 'web' })
          ])
        })
      );
    });
  });

  describe('analyzeProduct', () => {
    it('should analyze product successfully', async () => {
      const mockResponse = {
        content: `PRICING ANALYSIS:
Supplier Price: $15
Recommended Price: $45
Margin: 200%

MARKET DEMAND:
Search Volume: High
Demand Level: 8/10

COMPETITION ANALYSIS:
Competitors: 25
Competition Level: Medium

CONTENT AVAILABILITY:
Content Score: 85
Images: Excellent
Videos: Good

SUPPLIER ASSESSMENT:
Reliability: 8/10
Inventory: In Stock

RECOMMENDATION: PROCEED - Good profit potential with manageable competition`,
        citations: ['https://example.com/analysis'],
        usage: { promptTokens: 150, completionTokens: 100, totalTokens: 250 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const params = {
        productUrl: 'https://aliexpress.com/item/12345',
        targetMargin: 200
      };

      const result = await productTools.analyzeProduct(params);

      expect(result.success).toBe(true);
      expect(result.data.marginAnalysis.supplierPrice).toBe(15);
      expect(result.data.marginAnalysis.recommendedPrice).toBe(45);
      expect(result.data.contentScore).toBe(85);
      expect(result.data.competitorCount).toBe(25);
      expect(result.data.recommendation).toBe('proceed');
      expect(result.metadata.analyzedUrl).toBe(params.productUrl);
    });

    it('should handle analysis failures with default values', async () => {
      mockGrokClient.chatWithSearch.mockRejectedValueOnce(new Error('Analysis failed'));

      const result = await productTools.analyzeProduct({
        productUrl: 'https://example.com/product'
      });

      expect(result.success).toBe(false);
      expect(result.data.recommendation).toBe('caution');
      expect(result.data.marginAnalysis.supplierPrice).toBe(15);
      expect(result.data.contentScore).toBe(50);
    });

    it('should parse recommendation correctly', async () => {
      const rejectResponse = {
        content: 'RECOMMENDATION: REJECT - Too much competition and low margins',
        citations: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(rejectResponse);

      const result = await productTools.analyzeProduct({
        productUrl: 'https://example.com/bad-product'
      });

      expect(result.data.recommendation).toBe('reject');
    });
  });

  describe('spyCompetitors', () => {
    it('should analyze competitors successfully', async () => {
      const mockResponse = {
        content: `ACTIVE COMPETITORS:
Ads: 15
Found 15 advertisers for this product
Average ad spend: $500/day

AD CREATIVE ANALYSIS:
Top angles:
- Problem-solving approach
- Lifestyle enhancement
- Value proposition

PRICING STRATEGIES:
Average price: $35
Range: $25-$50

MARKET SATURATION:
Competition level: Medium
Opportunities:
- Better video content
- Unique targeting approach`,
        citations: ['https://facebook.com/ads-library'],
        usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await productTools.spyCompetitors('wireless charger', 'facebook');

      expect(result.success).toBe(true);
      expect(result.data.productName).toBe('wireless charger');
      expect(result.data.platform).toBe('facebook');
      expect(result.data.adCount).toBe(15);
      expect(result.data.averagePrice).toBe(35);
      expect(result.data.topAngles).toContain('Problem-solving approach');
      expect(result.data.opportunities).toContain('Better video content');
    });

    it('should handle competitor analysis failures', async () => {
      mockGrokClient.chatWithSearch.mockRejectedValueOnce(new Error('Competitor analysis failed'));

      const result = await productTools.spyCompetitors('test product', 'tiktok');

      expect(result.success).toBe(false);
      expect(result.data.productName).toBe('test product');
      expect(result.data.platform).toBe('tiktok');
      expect(result.data.marketSaturation).toBe('medium');
    });

    it('should determine market saturation correctly', async () => {
      const highCompetitionResponse = {
        content: 'Advertisers: 35\nFound 35 advertisers for this product',
        citations: [],
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(highCompetitionResponse);

      const result = await productTools.spyCompetitors('popular product', 'facebook');

      expect(result.data.marketSaturation).toBe('high');
    });
  });

  describe('findTrendingProducts', () => {
    it('should find trending products successfully', async () => {
      const mockResponse = {
        content: `Product 1:
Name: Smart Water Bottle
Trend Strength: 9
Category: Health & Fitness
Demand Duration: 6 months
Key Drivers:
- Health consciousness trend
- Smart device integration

Product 2:
Name: Eco-friendly Phone Case
Trend Strength: 7
Category: Electronics
Demand Duration: 3-4 months
Key Drivers:
- Environmental awareness
- Sustainable materials trend`,
        citations: ['https://trends.google.com', 'https://twitter.com/trending'],
        usage: { promptTokens: 200, completionTokens: 150, totalTokens: 350 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await productTools.findTrendingProducts('health', 'month');

      expect(result.success).toBe(true);
      expect(result.data.products).toHaveLength(2);
      expect(result.data.products[0].name).toBe('Smart Water Bottle');
      expect(result.data.products[0].trendStrength).toBe(9);
      expect(result.data.category).toBe('health');
      expect(result.data.timeframe).toBe('month');
      expect(result.data.trendStrength).toBeGreaterThan(7); // Average of 9 and 7
    });

    it('should handle trending products search failure', async () => {
      mockGrokClient.chatWithSearch.mockRejectedValueOnce(new Error('Trending search failed'));

      const result = await productTools.findTrendingProducts();

      expect(result.success).toBe(false);
      expect(result.data.category).toBe('all');
      expect(result.data.products).toEqual([]);
    });

    it('should use correct search sources for trending products', async () => {
      mockGrokClient.chatWithSearch.mockResolvedValueOnce({
        content: 'No trending products found',
        citations: [],
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 }
      });

      await productTools.findTrendingProducts('tech', 'week');

      expect(mockGrokClient.chatWithSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          sources: expect.arrayContaining([
            expect.objectContaining({ type: 'web', allowed_websites: expect.arrayContaining(['trends.google.com']) }),
            expect.objectContaining({ type: 'x' }),
            expect.objectContaining({ type: 'news' })
          ])
        })
      );
    });
  });

  describe('validateSupplier', () => {
    it('should validate supplier successfully', async () => {
      const mockResponse = {
        content: `SUPPLIER ANALYSIS:
Reliability Score: 8/10
Inventory Status: In Stock (500+ units)
Shipping: 7-12 days
Communication: Responsive within 24 hours

RECOMMENDATIONS:
- Order sample first
- Verify inventory before scaling
- Establish clear communication

RISKS:
- Potential shipping delays during peak season
- Price fluctuations possible`,
        citations: ['https://supplier-reviews.com'],
        usage: { promptTokens: 80, completionTokens: 60, totalTokens: 140 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await productTools.validateSupplier(
        'https://aliexpress.com/store/12345',
        'Wireless Charger'
      );

      expect(result.success).toBe(true);
      expect(result.data.reliabilityScore).toBe(8);
      expect(result.data.inventoryStatus).toContain('In Stock');
      expect(result.data.shippingTime).toBe('7-12 days');
      expect(result.data.recommendations).toContain('Order sample first');
      expect(result.data.risks).toContain('Potential shipping delays during peak season');
    });

    it('should handle supplier validation failure', async () => {
      mockGrokClient.chatWithSearch.mockRejectedValueOnce(new Error('Validation failed'));

      const result = await productTools.validateSupplier(
        'https://example.com/supplier',
        'Test Product'
      );

      expect(result.success).toBe(false);
      expect(result.data.reliabilityScore).toBe(5);
      expect(result.data.inventoryStatus).toBe('unknown');
      expect(result.data.recommendations).toContain('Manual verification required');
    });
  });

  describe('parsing helpers', () => {
    it('should extract prices correctly from various formats', async () => {
      const responses = [
        'Supplier price: $15.99',
        'Cost: 12.50',
        'Wholesale: $8'
      ];

      for (const content of responses) {
        mockGrokClient.chatWithSearch.mockResolvedValueOnce({
          content,
          citations: [],
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
        });

        const result = await productTools.analyzeProduct({
          productUrl: 'https://example.com/test'
        });

        expect(result.data.marginAnalysis.supplierPrice).toBeGreaterThan(0);
      }
    });

    it('should handle unstructured product search results', async () => {
      const mockResponse = {
        content: `Here are some great products:
Smartphone accessories are trending
Fitness equipment is popular
Home organization tools
Kitchen gadgets for cooking`,
        citations: [],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await productTools.searchProducts({ query: 'general' });

      expect(result.success).toBe(true);
      expect(result.data.products.length).toBeGreaterThan(0);
      expect(result.data.products[0]).toHaveProperty('name');
      expect(result.data.products[0]).toHaveProperty('supplierPrice');
      expect(result.data.products[0]).toHaveProperty('recommendedPrice');
    });

    it('should extract marketing angles from competitor analysis', async () => {
      const mockResponse = {
        content: `ACTIVE COMPETITORS: 10 advertisers found

AD CREATIVE ANALYSIS:
Top marketing angles:
- Solve daily problems angle
- Enhance lifestyle quality approach
- Save time and money strategy
- Professional appearance angle
- Health and wellness focus approach`,
        citations: [],
        usage: { promptTokens: 60, completionTokens: 40, totalTokens: 100 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await productTools.spyCompetitors('test product', 'facebook');

      expect(result.data.topAngles).toContain('Solve daily problems angle');
      expect(result.data.topAngles).toContain('Enhance lifestyle quality approach');
      expect(result.data.topAngles.length).toBeGreaterThan(2);
    });
  });

  describe('search source configuration', () => {
    it('should use platform-specific sources', async () => {
      mockGrokClient.chatWithSearch.mockResolvedValue({
        content: 'Test response',
        citations: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      });

      // Test AliExpress specific
      await productTools.searchProducts({ query: 'test', platform: 'aliexpress' });
      expect(mockGrokClient.chatWithSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          sources: expect.arrayContaining([
            expect.objectContaining({ 
              type: 'web', 
              allowed_websites: expect.arrayContaining(['aliexpress.com']) 
            })
          ])
        })
      );

      // Test Amazon specific
      await productTools.searchProducts({ query: 'test', platform: 'amazon' });
      expect(mockGrokClient.chatWithSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          sources: expect.arrayContaining([
            expect.objectContaining({ 
              type: 'web', 
              allowed_websites: expect.arrayContaining(['amazon.com']) 
            })
          ])
        })
      );
    });

    it('should use appropriate sources for competitor analysis', async () => {
      mockGrokClient.chatWithSearch.mockResolvedValue({
        content: 'Test response',
        citations: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
      });

      await productTools.spyCompetitors('test', 'facebook');
      expect(mockGrokClient.chatWithSearch).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          sources: expect.arrayContaining([
            expect.objectContaining({ type: 'web' }),
            expect.objectContaining({ type: 'news' })
          ])
        })
      );
    });
  });
});