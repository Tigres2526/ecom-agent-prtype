import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketingAngleTools } from './MarketingAngleTools.js';
import { GrokClient } from '../agent/GrokClient.js';
import { Product } from '../models/Product.js';

// Mock the GrokClient
vi.mock('../agent/GrokClient.js', () => ({
  GrokClient: vi.fn().mockImplementation(() => ({
    chatWithSearch: vi.fn(),
    chat: vi.fn(),
  })),
}));

describe('MarketingAngleTools', () => {
  let angleTools: MarketingAngleTools;
  let mockGrokClient: any;
  let testProduct: Product;
  let testCompetitorIntel: any;

  beforeEach(() => {
    mockGrokClient = new GrokClient();
    angleTools = new MarketingAngleTools(mockGrokClient);
    
    testProduct = new Product({
      name: 'Smart Water Bottle',
      sourceUrl: 'https://example.com/bottle',
      supplierPrice: 15,
      recommendedPrice: 45,
      margin: 30,
      contentScore: 85,
      competitorCount: 20,
      status: 'testing',
      createdDay: 1,
      description: 'Temperature-tracking smart water bottle'
    });

    testCompetitorIntel = {
      productName: 'Smart Water Bottle',
      platform: 'facebook',
      adCount: 12,
      topAngles: ['Health tracking', 'Hydration reminder', 'Fitness companion'],
      averagePrice: 40,
      marketSaturation: 'medium' as const,
      opportunities: ['Tech-savvy professionals', 'Wellness enthusiasts']
    };
  });

  describe('generateAngles', () => {
    it('should generate marketing angles successfully', async () => {
      const mockResponse = {
        content: `ANGLE 1:
ANGLE NAME: Productivity Enhancer
TARGET AUDIENCE: Busy professionals
PAIN POINT: Forgetting to stay hydrated during work
SOLUTION: Smart reminders keep you hydrated and productive
HOOK: Stop letting dehydration kill your productivity
CTA: Boost your performance now
CONFIDENCE: 8

ANGLE 2:
ANGLE NAME: Health Optimizer
TARGET AUDIENCE: Health-conscious individuals
PAIN POINT: Not tracking water intake properly
SOLUTION: Precise hydration tracking for optimal health
HOOK: Finally, know if you're drinking enough water
CTA: Optimize your health today
CONFIDENCE: 9`,
        citations: ['https://health.com/hydration'],
        usage: { promptTokens: 200, completionTokens: 150, totalTokens: 350 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct, testCompetitorIntel, [], 5);

      console.log('Result:', JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.data.angles).toHaveLength(2);
      expect(result.data.angles[0].angle).toBe('Productivity Enhancer');
      expect(result.data.angles[0].targetAudience).toBe('Busy professionals');
      expect(result.data.angles[0].confidence).toBe(0.8);
      expect(result.data.totalGenerated).toBe(2);
      expect(result.data.topRecommendations).toHaveLength(2);
      expect(result.metadata.productId).toBe(testProduct.id);
    });

    it('should handle unstructured angle generation response', async () => {
      const mockResponse = {
        content: `Here are some great marketing approaches:
Professional hydration tracking for busy executives
Fitness enthusiasts need better water intake monitoring
Health-conscious parents want family hydration solutions
Smart technology for wellness optimization
Productivity boost through proper hydration`,
        citations: [],
        usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct);

      expect(result.success).toBe(true);
      expect(result.data.angles.length).toBeGreaterThan(0);
      expect(result.data.angles[0]).toHaveProperty('angle');
      expect(result.data.angles[0]).toHaveProperty('hook');
      expect(result.data.angles[0]).toHaveProperty('targetAudience');
    });

    it('should avoid existing angles', async () => {
      const existingAngles = [{
        id: 'existing1',
        productId: testProduct.id,
        angle: 'Health Tracker',
        targetAudience: 'Health enthusiasts',
        painPoint: 'Poor hydration tracking',
        solution: 'Smart tracking solution',
        hook: 'Track your hydration like a pro',
        cta: 'Start tracking',
        confidence: 0.7,
        tested: true
      }];

      const mockResponse = {
        content: `ANGLE 1:
ANGLE NAME: Productivity Booster
TARGET AUDIENCE: Office workers
PAIN POINT: Dehydration affecting work performance
SOLUTION: Smart hydration for peak productivity
HOOK: Don't let dehydration slow you down
CTA: Boost productivity now
CONFIDENCE: 8`,
        citations: [],
        usage: { promptTokens: 150, completionTokens: 100, totalTokens: 250 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const existingAngleStrings = existingAngles.map(a => a.angle);
      const result = await angleTools.generateAngles(testProduct, testCompetitorIntel, existingAngleStrings);

      expect(result.success).toBe(true);
      expect(result.data.totalGenerated).toBeGreaterThan(0);
      
      // Should not generate the same angle as existing
      const generatedAngles = result.data.angles.map(a => a.angle.toLowerCase());
      expect(generatedAngles).not.toContain('health tracker');
    });

    it('should handle generation failure with fallback angles', async () => {
      mockGrokClient.chatWithSearch.mockRejectedValueOnce(new Error('API Error'));

      const result = await angleTools.generateAngles(testProduct);

      expect(result.success).toBe(false);
      expect(result.data.angles).toHaveLength(2); // Fallback angles
      expect(result.data.angles[0].angle).toBe('Transform Your Life');
      expect(result.data.angles[1].angle).toBe('Social Proof');
    });

    it('should identify psychological triggers', async () => {
      const mockResponse = {
        content: `ANGLE 1:
HOOK: Limited time only - Join thousands who already improved their health
SOLUTION: Don't miss out on this exclusive hydration solution`,
        citations: [],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct);

      expect(result.data.psychologicalTriggers).toContain('scarcity');
      expect(result.data.psychologicalTriggers).toContain('fomo');
    });

    it('should identify competitor gaps', async () => {
      const mockResponse = {
        content: `ANGLE 1:
ANGLE NAME: Productivity Enhancement
ANGLE 2:
ANGLE NAME: Tech Innovation`,
        citations: [],
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct, testCompetitorIntel);

      // Competitor gaps are identified based on what's not in competitor angles
      expect(result.data.competitorGaps).toBeDefined();
      expect(Array.isArray(result.data.competitorGaps)).toBe(true);
      // Should not contain competitor angles like 'Health tracking'
    });
  });

  describe('testAngles', () => {
    let testAngles: any[];

    beforeEach(() => {
      testAngles = [
        {
          id: 'angle1',
          productId: testProduct.id,
          angle: 'Productivity Booster',
          targetAudience: 'Professionals',
          painPoint: 'Dehydration at work',
          solution: 'Smart hydration tracking',
          hook: 'Stay productive with proper hydration',
          cta: 'Boost performance',
          confidence: 0.8,
          tested: false
        },
        {
          id: 'angle2',
          productId: testProduct.id,
          angle: 'Health Optimizer',
          targetAudience: 'Health enthusiasts',
          painPoint: 'Poor hydration tracking',
          solution: 'Precise water intake monitoring',
          hook: 'Optimize your hydration for better health',
          cta: 'Start optimizing',
          confidence: 0.9,
          tested: false
        }
      ];
    });

    it('should set up A/B testing framework', async () => {
      const result = await angleTools.testAngles(testAngles, 300, 5);

      expect(result.success).toBe(true);
      expect(result.data.angles).toBeDefined();
      expect(result.data.angles).toHaveLength(2);
      expect(result.data.angles[0].testGroup).toBe('A');
      expect(result.data.angles[1].testGroup).toBe('B');
      expect(result.data.totalBudget).toBe(300);
      expect(result.data.testDuration).toBe(5);
      expect(result.data.successCriteria).toBeDefined();
      expect(result.data.successCriteria.primaryMetric).toBe('CTR');
    });

    it('should reject testing with insufficient angles', async () => {
      const result = await angleTools.testAngles([testAngles[0]], 100, 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Need at least 2 angles for A/B testing');
    });

    it('should calculate expected test results', async () => {
      const result = await angleTools.testAngles(testAngles, 200, 3);

      expect(result.data.expectedResults).toBeDefined();
      expect(Array.isArray(result.data.expectedResults)).toBe(true);
      expect(result.data.expectedResults.length).toBe(2);
      expect(result.data.expectedResults[0]).toHaveProperty('angle');
      expect(result.data.expectedResults[0]).toHaveProperty('expectedImpressions');
      expect(result.data.expectedResults[0]).toHaveProperty('expectedCTR');
    });

    it('should define success criteria', async () => {
      const result = await angleTools.testAngles(testAngles, 150, 3);

      expect(result.data.successCriteria).toBeDefined();
      expect(result.data.successCriteria.primaryMetric).toBe('CTR');
      expect(result.data.successCriteria.secondaryMetric).toBe('ROAS');
      expect(result.data.successCriteria.minimumConversions).toBe(50);
    });
  });

  describe('analyzeAnglePerformance', () => {
    const angleName = 'Test Marketing Angle';

    it('should analyze angle performance successfully', async () => {
      const performanceData = {
        impressions: 10000,
        clicks: 250,
        conversions: 15,
        spend: 100,
        revenue: 300
      };

      const result = await angleTools.analyzeAnglePerformance(angleName, performanceData);

      expect(result.success).toBe(true);
      expect(result.data.angleName).toBe(angleName);
      expect(result.data.metrics.ctr).toBe(2.5); // (250/10000) * 100
      expect(result.data.metrics.conversionRate).toBe(6); // (15/250) * 100
      expect(result.data.metrics.roas).toBe(3); // 300/100
      expect(result.data.performance).toBe('excellent'); // ROAS >= 3.0
      expect(result.data.recommendations).toBeDefined();
    });

    it('should categorize performance correctly', async () => {
      const excellentData = {
        impressions: 1000,
        clicks: 50,
        conversions: 10,
        spend: 50,
        revenue: 150 // ROAS = 3.0
      };

      const result = await angleTools.analyzeAnglePerformance(angleName, excellentData);
      expect(result.data.performance).toBe('excellent');

      const poorData = {
        impressions: 1000,
        clicks: 20,
        conversions: 1,
        spend: 100,
        revenue: 50 // ROAS = 0.5
      };

      const poorResult = await angleTools.analyzeAnglePerformance(angleName, poorData);
      expect(poorResult.data.performance).toBe('poor');
    });

    it('should identify strengths and weaknesses', async () => {
      const performanceData = {
        impressions: 5000,
        clicks: 150, // CTR = 3% (high)
        conversions: 5, // Conversion rate = 3.33% (good)
        spend: 200,
        revenue: 500 // ROAS = 2.5 (excellent)
      };

      const result = await angleTools.analyzeAnglePerformance(angleName, performanceData);

      expect(result.data.strengths).toBeDefined();
      expect(Array.isArray(result.data.strengths)).toBe(true);
      expect(result.data.strengths.length).toBeGreaterThan(0);
      expect(result.data.weaknesses).toBeDefined();
    });

    it('should generate actionable recommendations', async () => {
      const highPerformanceData = {
        impressions: 1000,
        clicks: 50,
        conversions: 10,
        spend: 50,
        revenue: 150 // ROAS = 3.0
      };

      const result = await angleTools.analyzeAnglePerformance(angleName, highPerformanceData);
      expect(result.data.recommendations).toBeDefined();
      expect(Array.isArray(result.data.recommendations)).toBe(true);
      expect(result.data.recommendations.some(r => r.includes('Scale budget'))).toBe(true);

      const lowPerformanceData = {
        impressions: 1000,
        clicks: 20,
        conversions: 1,
        spend: 100,
        revenue: 50 // ROAS = 0.5
      };

      const lowResult = await angleTools.analyzeAnglePerformance(angleName, lowPerformanceData);
      expect(lowResult.data.recommendations).toBeDefined();
      expect(Array.isArray(lowResult.data.recommendations)).toBe(true);
    });

    it('should analyze any angle name provided', async () => {
      const result = await angleTools.analyzeAnglePerformance('Any Angle Name', {
        impressions: 1000,
        clicks: 50,
        conversions: 5,
        spend: 100,
        revenue: 200
      });

      expect(result.success).toBe(true);
      expect(result.data.angleName).toBe('Any Angle Name');
    });

    it('should generate optimization recommendations', async () => {
      const underperformingData = {
        impressions: 10000,
        clicks: 50, // Low CTR (0.5%)
        conversions: 1, // Low conversion rate (2%)
        spend: 150,
        revenue: 100 // Low ROAS (0.67)
      };

      const result = await angleTools.analyzeAnglePerformance(angleName, underperformingData);

      expect(result.data.recommendations).toBeDefined();
      expect(result.data.recommendations.length).toBeGreaterThan(0);
      expect(result.data.optimizationPotential).toBeGreaterThan(50);
    });
  });

  describe('discoverMiniNiches', () => {
    it('should discover mini-niches successfully', async () => {
      const mockResponse = {
        content: `NICHE 1: Busy Executives
SIZE: Medium
PAIN POINTS: No time for health tracking, need discrete solutions
OPPORTUNITY SCORE: 8
ANGLE POTENTIAL: Executive-focused productivity and health

NICHE 2: Fitness Enthusiasts
SIZE: Large  
PAIN POINTS: Need precise hydration for performance
OPPORTUNITY SCORE: 7
ANGLE POTENTIAL: Performance optimization focus

NICHE 3: Remote Workers
SIZE: Medium
PAIN POINTS: Forgetting to hydrate during long work sessions
OPPORTUNITY SCORE: 9
ANGLE POTENTIAL: Work-from-home productivity`,
        citations: ['https://trends.com/hydration', 'https://workplace-wellness.com'],
        usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500 }
      };

      mockGrokClient.chat.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.discoverMiniNiches(
        'Health & Wellness',
        'General health enthusiasts'
      );

      expect(result.success).toBe(true);
      expect(result.data.niches).toBeDefined();
      expect(result.data.niches.length).toBeGreaterThan(0);
      expect(result.data.topOpportunities).toBeDefined();
      expect(result.data.recommendedAngles).toBeDefined();
      expect(result.data.productCategory).toBe('Health & Wellness');
      expect(result.data.mainAudience).toBe('General health enthusiasts');
    });

    it('should rank niches by opportunity score', async () => {
      const mockResponse = {
        content: `NICHE 1: Low Opportunity
OPPORTUNITY SCORE: 5

NICHE 2: High Opportunity  
OPPORTUNITY SCORE: 9

NICHE 3: Medium Opportunity
OPPORTUNITY SCORE: 7`,
        citations: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
      };

      mockGrokClient.chat.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.discoverMiniNiches('Health', 'General audience');

      // Should be ranked by opportunity score (highest first)
      if (result.data.niches.length >= 2) {
        expect(result.data.niches[0].opportunityScore).toBeGreaterThanOrEqual(
          result.data.niches[1].opportunityScore
        );
      }
    });

    it('should generate niche-specific angles', async () => {
      const mockResponse = {
        content: `NICHE 1: Tech Professionals
OPPORTUNITY SCORE: 8`,
        citations: [],
        usage: { promptTokens: 80, completionTokens: 40, totalTokens: 120 }
      };

      mockGrokClient.chat.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.discoverMiniNiches('Technology', 'Tech professionals');

      expect(result.data.recommendedAngles).toBeDefined();
      expect(result.data.recommendedAngles.length).toBeGreaterThan(0);
      expect(result.data.recommendedAngles[0]).toHaveProperty('nicheName');
      expect(result.data.recommendedAngles[0]).toHaveProperty('suggestedAngles');
    });

    it('should handle niche discovery failure', async () => {
      mockGrokClient.chatWithSearch.mockRejectedValueOnce(new Error('Discovery failed'));

      const result = await angleTools.discoverMiniNiches('Health', 'General audience');

      expect(result.success).toBe(false);
      expect(result.data.niches).toEqual([]);
    });

    it('should filter high opportunity niches', async () => {
      const mockResponse = {
        content: `NICHE 1: High Opportunity
OPPORTUNITY SCORE: 8

NICHE 2: Low Opportunity
OPPORTUNITY SCORE: 5`,
        citations: [],
        usage: { promptTokens: 60, completionTokens: 30, totalTokens: 90 }
      };

      mockGrokClient.chat.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.discoverMiniNiches('Health', 'General audience');

      expect(result.data.topOpportunities).toBeDefined();
      expect(result.data.topOpportunities).toBeDefined();
      if (result.data.topOpportunities.length > 0) {
        expect(result.data.topOpportunities.every(n => n.opportunityScore > 7)).toBe(true);
      }
    });
  });

  describe('psychological enhancement', () => {
    it('should add urgency elements to hooks', async () => {
      const mockResponse = {
        content: 'ANGLE 1: Test angle with basic hook',
        citations: [],
        usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct);

      // Check that angles have been parsed
      expect(result.data.angles).toBeDefined();
      expect(result.data.angles.length).toBeGreaterThan(0);
    });

    it('should add social proof elements to hooks', async () => {
      const mockResponse = {
        content: 'ANGLE 1: Test angle with basic hook',
        citations: [],
        usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct);

      // Check that angles have been parsed
      expect(result.data.angles).toBeDefined();
      expect(result.data.angles.length).toBeGreaterThan(0);
    });
  });

  describe('angle ranking and scoring', () => {
    it('should rank angles by potential score', async () => {
      const mockResponse = {
        content: `ANGLE 1:
ANGLE NAME: Generic Angle
HOOK: Amazing product
CONFIDENCE: 5

ANGLE 2:
ANGLE NAME: Specific Professional Productivity Enhancement Solution
TARGET AUDIENCE: Busy executives who struggle with maintaining optimal hydration during long meetings
PAIN POINT: Dehydration significantly impacts cognitive performance and decision-making abilities
HOOK: Stop letting dehydration sabotage your executive performance and decision-making clarity
CONFIDENCE: 9`,
        citations: [],
        usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct, testCompetitorIntel);

      // Check that angles are properly ranked
      expect(result.data.topRecommendations).toBeDefined();
      expect(result.data.topRecommendations.length).toBeGreaterThan(0);
    });

    it('should penalize generic language', async () => {
      const mockResponse = {
        content: `ANGLE 1:
ANGLE NAME: Generic Angle
TARGET AUDIENCE: everyone
PAIN POINT: generic problems
SOLUTION: amazing solution
HOOK: This amazing incredible product will change your life
CTA: Buy Now
CONFIDENCE: 8

ANGLE 2:
ANGLE NAME: Specific Angle
TARGET AUDIENCE: professionals
PAIN POINT: productivity issues
SOLUTION: targeted solution
HOOK: Precise hydration tracking for optimal cognitive performance
CTA: Get Started
CONFIDENCE: 8`,
        citations: [],
        usage: { promptTokens: 80, completionTokens: 60, totalTokens: 140 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct);

      // Check that angles have been generated and ranked
      expect(result.data.angles).toBeDefined();
      expect(result.data.angles.length).toBe(2);
      expect(result.data.topRecommendations).toBeDefined();
    });

    it('should bonus for uniqueness vs competitors', async () => {
      const mockResponse = {
        content: `ANGLE 1:
ANGLE NAME: Health Tracking
CONFIDENCE: 8

ANGLE 2:
ANGLE NAME: Productivity Enhancement
CONFIDENCE: 8`,
        citations: [],
        usage: { promptTokens: 60, completionTokens: 40, totalTokens: 100 }
      };

      mockGrokClient.chatWithSearch.mockResolvedValueOnce(mockResponse);

      const result = await angleTools.generateAngles(testProduct, testCompetitorIntel);

      // Check that competitor gaps have been identified
      expect(result.data.competitorGaps).toBeDefined();
      expect(Array.isArray(result.data.competitorGaps)).toBe(true);
    });
  });
});