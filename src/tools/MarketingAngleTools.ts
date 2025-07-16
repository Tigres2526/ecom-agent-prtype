import type { 
  ToolResult,
  CampaignData,
  MarketingAngle
} from '../types/index.js';
import { GrokClient } from '../agent/GrokClient.js';

/**
 * Marketing angle generation and optimization tools
 */
export class MarketingAngleTools {
  private grokClient: GrokClient;

  constructor(grokClient: GrokClient) {
    this.grokClient = grokClient;
  }

  /**
   * Generates new marketing angles for a product
   */
  public async generateAngles(
    product: any,
    competitorIntel?: any,
    existingAngles: string[] = [],
    count: number = 5
  ): Promise<ToolResult> {
    try {
      const prompt = this.buildAngleGenerationPrompt(product, competitorIntel, existingAngles, count);
      
      const response = await this.grokClient.chatWithSearch([
        {
          role: 'system',
          content: 'You are a marketing psychology expert specializing in creating compelling angles for dropshipping products.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        mode: 'on',
        maxResults: 10,
        returnCitations: true
      });

      const angles = this.parseGeneratedAngles(response.content);
      const topRecommendations = this.rankAnglesByScore(angles).slice(0, 3);
      
      return {
        success: true,
        data: {
          angles,
          totalGenerated: angles.length,
          topRecommendations,
          psychologicalTriggers: this.identifyPsychologicalTriggers(angles),
          competitorGaps: competitorIntel ? this.identifyCompetitorGaps(angles, JSON.stringify(competitorIntel)) : []
        },
        metadata: {
          productId: product.id,
          generatedAt: new Date().toISOString(),
          usage: response.usage
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Angle generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {
          angles: this.getFallbackAngles(product.name),
          totalGenerated: 2,
          topRecommendations: []
        }
      };
    }
  }

  /**
   * Sets up A/B testing framework for angles
   */
  public async testAngles(angles: any[], budget: number, duration: number): Promise<ToolResult> {
    if (angles.length < 2) {
      return {
        success: false,
        error: 'Need at least 2 angles for A/B testing',
        data: {}
      };
    }

    const testPlan = {
      angles: angles.map((angle, index) => ({
        ...angle,
        testGroup: String.fromCharCode(65 + index), // A, B, C...
        budgetAllocation: budget / angles.length,
        expectedDuration: duration
      })),
      totalBudget: budget,
      testDuration: duration,
      successCriteria: {
        primaryMetric: 'CTR',
        secondaryMetric: 'ROAS',
        minimumConversions: 50
      },
      expectedResults: this.calculateExpectedResults(angles, budget)
    };

    return {
      success: true,
      data: testPlan,
      metadata: {
        setupTime: new Date().toISOString()
      }
    };
  }

  /**
   * Analyzes performance of a marketing angle
   */
  public async analyzeAnglePerformance(
    angleName: string,
    metrics: {
      impressions: number;
      clicks: number;
      conversions: number;
      spend: number;
      revenue: number;
    }
  ): Promise<ToolResult> {
    const ctr = (metrics.clicks / metrics.impressions) * 100;
    const conversionRate = (metrics.conversions / metrics.clicks) * 100;
    const roas = metrics.revenue / metrics.spend;
    const cpc = metrics.spend / metrics.clicks;

    const performance = this.categorizePerformance(ctr, conversionRate, roas);
    const strengths = this.identifyStrengths(metrics, ctr, conversionRate, roas);
    const weaknesses = this.identifyWeaknesses(metrics, ctr, conversionRate, roas);
    const recommendations = this.generateOptimizationRecommendations(performance, strengths, weaknesses);

    return {
      success: true,
      data: {
        angleName,
        metrics: {
          ...metrics,
          ctr,
          conversionRate,
          roas,
          cpc
        },
        performance,
        strengths,
        weaknesses,
        recommendations,
        optimizationPotential: this.calculateOptimizationPotential(performance)
      },
      metadata: {
        analyzedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Discovers mini-niches within a product category
   */
  public async discoverMiniNiches(
    productCategory: string,
    mainAudience: string
  ): Promise<ToolResult> {
    try {
      const prompt = `Analyze the ${productCategory} market for ${mainAudience} and identify specific mini-niches with unique needs.
      
For each niche, provide:
- Niche name and description
- Estimated size (as percentage of main audience)
- Specific pain points
- Unique angle opportunities
- Competition level`;

      const response = await this.grokClient.simpleChat(
        'You are a market segmentation expert specializing in finding profitable micro-niches.',
        prompt
      );

      const niches = this.parseMiniNiches(response);
      const rankedNiches = this.rankNichesByOpportunity(niches);

      return {
        success: true,
        data: {
          productCategory,
          mainAudience,
          niches: rankedNiches,
          topOpportunities: rankedNiches.filter(n => n.opportunityScore > 7),
          recommendedAngles: this.generateNicheSpecificAngles(rankedNiches.slice(0, 3))
        },
        metadata: {
          discoveredAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Niche discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {
          productCategory,
          mainAudience,
          niches: []
        }
      };
    }
  }

  /**
   * Private helper methods
   */
  private buildAngleGenerationPrompt(product: any, competitorIntel: any, existingAngles: string[], count: number): string {
    let prompt = `Generate ${count} unique marketing angles for ${product.name}.`;
    
    if (product.description) {
      prompt += `\nProduct description: ${product.description}`;
    }
    
    if (existingAngles.length > 0) {
      prompt += `\n\nAvoid these existing angles:\n${existingAngles.join('\n')}`;
    }
    
    if (competitorIntel) {
      prompt += `\n\nCompetitor insights:\n${JSON.stringify(competitorIntel, null, 2)}`;
    }

    prompt += `\n\nFor each angle provide:
ANGLE NAME: [Name]
TARGET AUDIENCE: [Specific audience]
PAIN POINT: [Problem it solves]
SOLUTION: [How product helps]
HOOK: [Attention-grabbing opening]
CTA: [Call to action]
CONFIDENCE: [1-10 score]`;

    return prompt;
  }

  private parseGeneratedAngles(content: string): any[] {
    const angles: any[] = [];
    const sections = content.split(/(?=ANGLE \d+:|Angle \d+:)/i);

    for (const section of sections) {
      if (section.trim() && section.includes('ANGLE NAME:')) {
        const angle = this.extractAngleFromSection(section);
        if (angle) {
          angles.push(angle);
        }
      }
    }

    // Try to parse unstructured content if no angles found
    if (angles.length === 0) {
      const lines = content.split('\n').filter(line => line.trim().length > 10);
      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        angles.push({
          angle: `Angle ${i + 1}`,
          targetAudience: 'general',
          painPoint: 'General need',
          solution: lines[i].trim(),
          hook: lines[i].trim(),
          cta: 'Shop Now',
          confidence: 0.7
        });
      }
    }

    return angles;
  }

  private extractAngleFromSection(section: string): any | null {
    try {
      const angle = this.extractValue(section, ['angle name', 'name']) || 'Untitled Angle';
      const targetAudience = this.extractValue(section, ['target audience', 'audience']) || 'general';
      const painPoint = this.extractValue(section, ['pain point', 'problem']) || '';
      const solution = this.extractValue(section, ['solution']) || '';
      const hook = this.extractValue(section, ['hook']) || '';
      const cta = this.extractValue(section, ['cta', 'call to action']) || 'Shop Now';
      const confidenceStr = this.extractValue(section, ['confidence']) || '5';
      const confidence = parseFloat(confidenceStr) / 10; // Convert 1-10 to 0-1

      return {
        angle,
        targetAudience,
        painPoint,
        solution,
        hook,
        cta,
        confidence
      };
    } catch {
      return null;
    }
  }

  private extractValue(text: string, keywords: string[]): string | null {
    for (const keyword of keywords) {
      const regex = new RegExp(`${keyword}[:\\s]+([^\\n]+)`, 'i');
      const match = text.match(regex);
      if (match) return match[1].trim();
    }
    return null;
  }

  private getFallbackAngles(productName: string): any[] {
    return [
      {
        angle: 'Transform Your Life',
        targetAudience: 'general',
        painPoint: 'Missing out on life improvements',
        solution: `${productName} makes the difference`,
        hook: `Transform Your Life with ${productName}`,
        cta: 'Get Yours Today',
        confidence: 0.6
      },
      {
        angle: 'Social Proof',
        targetAudience: 'general',
        painPoint: 'Fear of missing out',
        solution: 'Join thousands who already benefit',
        hook: `Why Everyone's Talking About ${productName}`,
        cta: 'Don\'t Miss Out',
        confidence: 0.7
      }
    ];
  }

  private identifyPsychologicalTriggers(angles: any[]): string[] {
    const triggers = new Set<string>();
    
    for (const angle of angles) {
      // Identify triggers from content
      const content = `${angle.hook || ''} ${angle.solution || ''} ${angle.painPoint || ''}`.toLowerCase();
      
      if (content.includes('transform') || content.includes('change')) {
        triggers.add('transformation');
      }
      if (content.includes('miss') || content.includes('fomo')) {
        triggers.add('fomo');
      }
      if (content.includes('limited') || content.includes('only')) {
        triggers.add('scarcity');
      }
      if (content.includes('save') || content.includes('discount')) {
        triggers.add('value');
      }
      if (content.includes('exclusive') || content.includes('vip')) {
        triggers.add('exclusivity');
      }
      if (content.includes('productivity') || content.includes('performance')) {
        triggers.add('achievement');
      }
    }

    return Array.from(triggers);
  }

  private identifyCompetitorGaps(angles: any[], competitorInfo: string): string[] {
    const gaps: string[] = [];
    const competitorLower = competitorInfo.toLowerCase();

    if (!competitorLower.includes('sustainability') && 
        angles.some(a => (a.solution || '').toLowerCase().includes('eco'))) {
      gaps.push('Eco-friendly positioning');
    }

    if (!competitorLower.includes('guarantee') && 
        angles.some(a => (a.hook || '').toLowerCase().includes('guarantee'))) {
      gaps.push('Risk reversal messaging');
    }

    if (!competitorLower.includes('community') && 
        angles.some(a => (a.solution || '').toLowerCase().includes('join'))) {
      gaps.push('Community building angle');
    }

    return gaps;
  }

  private calculateExpectedResults(angles: any[], budget: number): any {
    const budgetPerAngle = budget / angles.length;
    const cpmEstimate = 10; // $10 CPM estimate
    const expectedImpressions = (budgetPerAngle / cpmEstimate) * 1000;

    return angles.map(angle => ({
      angle: angle.hook,
      expectedImpressions,
      expectedCTR: 2 + (angle.potentialScore * 0.3),
      expectedConversions: Math.floor(expectedImpressions * 0.02 * (angle.potentialScore / 10)),
      confidenceInterval: '�20%'
    }));
  }

  private categorizePerformance(ctr: number, conversionRate: number, roas: number): string {
    if (roas >= 3 && ctr >= 2 && conversionRate >= 2) return 'excellent';
    if (roas >= 2 && ctr >= 1.5 && conversionRate >= 1.5) return 'good';
    if (roas >= 1.5 && ctr >= 1 && conversionRate >= 1) return 'average';
    return 'poor';
  }

  private identifyStrengths(metrics: any, ctr: number, conversionRate: number, roas: number): string[] {
    const strengths: string[] = [];
    
    if (ctr > 2.5) strengths.push('High click-through rate');
    if (conversionRate > 3) strengths.push('Strong conversion rate');
    if (roas > 3) strengths.push('Excellent return on ad spend');
    if (metrics.clicks / metrics.impressions > 0.025) strengths.push('Compelling creative');

    return strengths;
  }

  private identifyWeaknesses(metrics: any, ctr: number, conversionRate: number, roas: number): string[] {
    const weaknesses: string[] = [];
    
    if (ctr < 1) weaknesses.push('Low click-through rate');
    if (conversionRate < 1) weaknesses.push('Poor conversion rate');
    if (roas < 1.5) weaknesses.push('Below target ROAS');
    if (metrics.spend / metrics.clicks > 5) weaknesses.push('High cost per click');

    return weaknesses;
  }

  private generateOptimizationRecommendations(
    performance: string,
    strengths: string[],
    weaknesses: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (performance === 'poor' || performance === 'average') {
      if (weaknesses.includes('Low click-through rate')) {
        recommendations.push('Test new creative variations');
        recommendations.push('Refine audience targeting');
      }
      if (weaknesses.includes('Poor conversion rate')) {
        recommendations.push('Optimize landing page');
        recommendations.push('Improve offer clarity');
      }
    }

    if (performance === 'good' || performance === 'excellent') {
      recommendations.push('Scale budget by 25-50%');
      recommendations.push('Test similar angles');
    }

    return recommendations;
  }

  private calculateOptimizationPotential(performance: string): number {
    const potentialMap: Record<string, number> = {
      poor: 80,
      average: 60,
      good: 40,
      excellent: 20
    };
    return potentialMap[performance] || 50;
  }

  private calculateAnglePotential(hook: string, message: string): number {
    let score = 5; // Base score
    
    // Bonus for specificity
    if (hook.match(/\d+/) || message.match(/\d+/)) score += 1;
    
    // Bonus for emotional words
    const emotionalWords = ['transform', 'amazing', 'breakthrough', 'exclusive', 'limited'];
    if (emotionalWords.some(word => hook.toLowerCase().includes(word))) score += 1;
    
    // Bonus for urgency
    if (hook.toLowerCase().includes('now') || hook.toLowerCase().includes('today')) score += 1;
    
    // Penalty for generic language
    if (hook.toLowerCase().includes('great') || hook.toLowerCase().includes('nice')) score -= 1;
    
    return Math.max(1, Math.min(10, score));
  }

  private parseMiniNiches(content: string): any[] {
    const niches: any[] = [];
    const sections = content.split(/(?=\d+\.|Niche \d+:|Mini-niche:)/i);

    for (const section of sections) {
      if (section.trim()) {
        const niche = this.extractNicheFromSection(section);
        if (niche) {
          niches.push(niche);
        }
      }
    }

    return niches;
  }

  private extractNicheFromSection(section: string): any {
    return {
      name: this.extractValue(section, ['niche name', 'name']) || 'Unnamed Niche',
      description: this.extractValue(section, ['description']) || '',
      estimatedSize: this.extractValue(section, ['size', 'estimated size']) || '5-10%',
      painPoints: this.extractList(section, ['pain points', 'problems']) || [],
      angleOpportunities: this.extractList(section, ['opportunities', 'angles']) || [],
      competitionLevel: this.extractValue(section, ['competition']) || 'medium',
      opportunityScore: Math.floor(Math.random() * 5) + 5 // Placeholder calculation
    };
  }

  private extractList(text: string, keywords: string[]): string[] {
    const items: string[] = [];
    const lines = text.split('\n');
    
    let inSection = false;
    for (const line of lines) {
      if (keywords.some(k => line.toLowerCase().includes(k))) {
        inSection = true;
        continue;
      }
      
      if (inSection && line.match(/^[-"*]/)) {
        items.push(line.replace(/^[-"*]\s*/, '').trim());
      } else if (inSection && line.trim() === '') {
        break;
      }
    }
    
    return items;
  }

  private rankNichesByOpportunity(niches: any[]): any[] {
    return niches.map(niche => {
      let score = 5;
      
      if (niche.competitionLevel === 'low') score += 2;
      if (niche.competitionLevel === 'high') score -= 1;
      if (niche.angleOpportunities.length > 3) score += 1;
      if (niche.painPoints.length > 2) score += 1;
      
      return { ...niche, opportunityScore: score };
    }).sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  private generateNicheSpecificAngles(topNiches: any[]): any[] {
    return topNiches.map(niche => ({
      nicheName: niche.name,
      suggestedAngles: [
        `The ${niche.name} Solution You've Been Waiting For`,
        `Finally, Something Made Just for ${niche.name}`,
        `Why ${niche.name} Choose This Over Everything Else`
      ]
    }));
  }

  /**
   * Adds psychological urgency elements to hooks
   */
  public addUrgencyToHook(hook: string): string {
    const urgencyPhrases = [
      'Limited Time: ',
      'Today Only: ',
      'Last Chance: ',
      '24 Hours Left: '
    ];
    
    const randomUrgency = urgencyPhrases[Math.floor(Math.random() * urgencyPhrases.length)];
    return randomUrgency + hook;
  }

  /**
   * Adds social proof elements to hooks
   */
  public addSocialProofToHook(hook: string): string {
    const socialProofPhrases = [
      ' (10,000+ Happy Customers)',
      ' - Rated #1 by Users',
      ' (As Seen on Social Media)',
      ' - Trending Now'
    ];
    
    const randomProof = socialProofPhrases[Math.floor(Math.random() * socialProofPhrases.length)];
    return hook + randomProof;
  }

  /**
   * Ranks angles by potential score
   */
  public rankAnglesByScore(angles: MarketingAngle[]): MarketingAngle[] {
    return [...angles].sort((a, b) => b.confidence - a.confidence);
  }
}