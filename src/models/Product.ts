import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { Product as IProduct, ProductAnalysis } from '../types/index.js';

// Validation schema for Product
const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Product name is required'),
  sourceUrl: z.string().url('Invalid source URL'),
  supplierPrice: z.number().positive('Supplier price must be positive'),
  recommendedPrice: z.number().positive('Recommended price must be positive'),
  margin: z.number().min(0, 'Margin cannot be negative'),
  contentScore: z.number().min(0).max(100, 'Content score must be 0-100'),
  competitorCount: z.number().min(0, 'Competitor count cannot be negative'),
  status: z.enum(['researching', 'testing', 'scaling', 'killed']),
  createdDay: z.number().min(0, 'Created day cannot be negative'),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export class Product implements IProduct {
  public readonly id: string;
  public name: string;
  public sourceUrl: string;
  public supplierPrice: number;
  public recommendedPrice: number;
  public margin: number;
  public contentScore: number;
  public competitorCount: number;
  public status: 'researching' | 'testing' | 'scaling' | 'killed';
  public createdDay: number;
  public description?: string;
  public category?: string;
  public tags?: string[];

  constructor(data: Omit<IProduct, 'id'> & { id?: string }) {
    const validated = ProductSchema.parse({
      id: data.id || uuidv4(),
      ...data,
    });

    this.id = validated.id;
    this.name = validated.name;
    this.sourceUrl = validated.sourceUrl;
    this.supplierPrice = validated.supplierPrice;
    this.recommendedPrice = validated.recommendedPrice;
    this.margin = validated.margin;
    this.contentScore = validated.contentScore;
    this.competitorCount = validated.competitorCount;
    this.status = validated.status;
    this.createdDay = validated.createdDay;
    this.description = validated.description;
    this.category = validated.category;
    this.tags = validated.tags;

    // Validate margin consistency
    this.validateMargin();
  }

  /**
   * Validates that margin calculation is consistent with prices
   */
  private validateMargin(): void {
    const calculatedMargin = this.recommendedPrice - this.supplierPrice;
    const marginDifference = Math.abs(this.margin - calculatedMargin);
    
    if (marginDifference > 0.01) { // Allow for small floating point differences
      throw new Error(
        `Margin inconsistency: Expected ${calculatedMargin}, got ${this.margin}`
      );
    }
  }

  /**
   * Calculates margin percentage
   */
  public getMarginPercentage(): number {
    return (this.margin / this.recommendedPrice) * 100;
  }

  /**
   * Calculates markup percentage
   */
  public getMarkupPercentage(): number {
    return (this.margin / this.supplierPrice) * 100;
  }

  /**
   * Checks if product meets minimum margin requirements (2-3x markup)
   */
  public meetsMarginRequirements(): boolean {
    const markup = this.getMarkupPercentage();
    return markup >= 200; // 2x minimum markup
  }

  /**
   * Validates if product is ready for testing
   */
  public isReadyForTesting(): boolean {
    return (
      this.status === 'researching' &&
      this.meetsMarginRequirements() &&
      this.contentScore >= 60 &&
      this.competitorCount < 50
    );
  }

  /**
   * Validates if product is ready for scaling
   */
  public isReadyForScaling(): boolean {
    return (
      this.status === 'testing' &&
      this.contentScore >= 70
    );
  }

  /**
   * Updates product status with validation
   */
  public updateStatus(newStatus: IProduct['status']): void {
    const validTransitions: Record<IProduct['status'], IProduct['status'][]> = {
      researching: ['testing', 'killed'],
      testing: ['scaling', 'killed'],
      scaling: ['killed'],
      killed: [], // No transitions from killed
    };

    const allowedTransitions = validTransitions[this.status];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${this.status} to ${newStatus}`
      );
    }

    this.status = newStatus;
  }

  /**
   * Updates pricing and recalculates margin
   */
  public updatePricing(supplierPrice: number, recommendedPrice: number): void {
    if (supplierPrice <= 0 || recommendedPrice <= 0) {
      throw new Error('Prices must be positive');
    }

    if (recommendedPrice <= supplierPrice) {
      throw new Error('Recommended price must be higher than supplier price');
    }

    this.supplierPrice = supplierPrice;
    this.recommendedPrice = recommendedPrice;
    this.margin = recommendedPrice - supplierPrice;
  }

  /**
   * Creates a product analysis summary
   */
  public getAnalysis(): ProductAnalysis {
    const marginPercent = this.getMarginPercentage();
    const markupPercent = this.getMarkupPercentage();

    let riskScore = 0;
    
    // Calculate risk based on various factors
    if (this.competitorCount > 30) riskScore += 30;
    if (this.contentScore < 60) riskScore += 25;
    if (markupPercent < 200) riskScore += 35;
    if (this.contentScore < 40) riskScore += 20;

    let recommendation: 'proceed' | 'caution' | 'reject' = 'proceed';
    if (riskScore > 60) recommendation = 'reject';
    else if (riskScore > 30) recommendation = 'caution';

    return {
      contentScore: this.contentScore,
      marginAnalysis: {
        supplierPrice: this.supplierPrice,
        recommendedPrice: this.recommendedPrice,
        margin: this.margin,
        marginPercent,
      },
      competitorCount: this.competitorCount,
      marketDemand: Math.max(0, 100 - this.competitorCount), // Simple demand calculation
      riskScore,
      recommendation,
    };
  }

  /**
   * Serializes product to JSON
   */
  public toJSON(): IProduct {
    return {
      id: this.id,
      name: this.name,
      sourceUrl: this.sourceUrl,
      supplierPrice: this.supplierPrice,
      recommendedPrice: this.recommendedPrice,
      margin: this.margin,
      contentScore: this.contentScore,
      competitorCount: this.competitorCount,
      status: this.status,
      createdDay: this.createdDay,
      description: this.description,
      category: this.category,
      tags: this.tags,
    };
  }

  /**
   * Creates Product instance from JSON data
   */
  public static fromJSON(data: IProduct): Product {
    return new Product(data);
  }

  /**
   * Validates product data without creating instance
   */
  public static validate(data: unknown): data is IProduct {
    try {
      ProductSchema.parse(data);
      return true;
    } catch {
      return false;
    }
  }
}