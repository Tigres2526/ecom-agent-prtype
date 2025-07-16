import { describe, it, expect } from 'vitest';
import { Product } from './Product.js';

describe('Product', () => {
  const validProductData = {
    name: 'Test Product',
    sourceUrl: 'https://example.com/product',
    supplierPrice: 10,
    recommendedPrice: 30,
    margin: 20,
    contentScore: 75,
    competitorCount: 15,
    status: 'researching' as const,
    createdDay: 1,
  };

  describe('constructor', () => {
    it('should create a valid product', () => {
      const product = new Product(validProductData);
      
      expect(product.name).toBe(validProductData.name);
      expect(product.supplierPrice).toBe(validProductData.supplierPrice);
      expect(product.recommendedPrice).toBe(validProductData.recommendedPrice);
      expect(product.margin).toBe(validProductData.margin);
      expect(product.id).toBeDefined();
    });

    it('should generate UUID if not provided', () => {
      const product = new Product(validProductData);
      expect(product.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should use provided ID', () => {
      const customId = '123e4567-e89b-12d3-a456-426614174000';
      const product = new Product({ ...validProductData, id: customId });
      expect(product.id).toBe(customId);
    });

    it('should throw error for invalid margin calculation', () => {
      expect(() => {
        new Product({
          ...validProductData,
          margin: 15, // Should be 20 (30 - 10)
        });
      }).toThrow('Margin inconsistency');
    });

    it('should throw error for negative prices', () => {
      expect(() => {
        new Product({
          ...validProductData,
          supplierPrice: -5,
        });
      }).toThrow();
    });

    it('should throw error for invalid URL', () => {
      expect(() => {
        new Product({
          ...validProductData,
          sourceUrl: 'not-a-url',
        });
      }).toThrow();
    });
  });

  describe('margin calculations', () => {
    it('should calculate margin percentage correctly', () => {
      const product = new Product(validProductData);
      expect(product.getMarginPercentage()).toBeCloseTo(66.67, 2);
    });

    it('should calculate markup percentage correctly', () => {
      const product = new Product(validProductData);
      expect(product.getMarkupPercentage()).toBe(200);
    });

    it('should check margin requirements', () => {
      const product = new Product(validProductData);
      expect(product.meetsMarginRequirements()).toBe(true);

      const lowMarginProduct = new Product({
        ...validProductData,
        recommendedPrice: 15,
        margin: 5,
      });
      expect(lowMarginProduct.meetsMarginRequirements()).toBe(false);
    });
  });

  describe('status management', () => {
    it('should allow valid status transitions', () => {
      const product = new Product(validProductData);
      
      expect(product.status).toBe('researching');
      product.updateStatus('testing');
      expect(product.status).toBe('testing');
      
      product.updateStatus('scaling');
      expect(product.status).toBe('scaling');
      
      product.updateStatus('killed');
      expect(product.status).toBe('killed');
    });

    it('should reject invalid status transitions', () => {
      const product = new Product(validProductData);
      
      expect(() => {
        product.updateStatus('scaling'); // Can't go directly from researching to scaling
      }).toThrow('Invalid status transition');
    });

    it('should not allow transitions from killed status', () => {
      const product = new Product({ ...validProductData, status: 'killed' });
      
      expect(() => {
        product.updateStatus('testing');
      }).toThrow('Invalid status transition');
    });
  });

  describe('readiness checks', () => {
    it('should check if ready for testing', () => {
      const product = new Product(validProductData);
      expect(product.isReadyForTesting()).toBe(true);

      const notReadyProduct = new Product({
        ...validProductData,
        contentScore: 50, // Below threshold
      });
      expect(notReadyProduct.isReadyForTesting()).toBe(false);
    });

    it('should check if ready for scaling', () => {
      const product = new Product({
        ...validProductData,
        status: 'testing',
        contentScore: 80,
      });
      expect(product.isReadyForScaling()).toBe(true);

      const notReadyProduct = new Product({
        ...validProductData,
        status: 'researching', // Wrong status
        contentScore: 80,
      });
      expect(notReadyProduct.isReadyForScaling()).toBe(false);
    });
  });

  describe('pricing updates', () => {
    it('should update pricing correctly', () => {
      const product = new Product(validProductData);
      
      product.updatePricing(15, 45);
      expect(product.supplierPrice).toBe(15);
      expect(product.recommendedPrice).toBe(45);
      expect(product.margin).toBe(30);
    });

    it('should reject invalid pricing', () => {
      const product = new Product(validProductData);
      
      expect(() => {
        product.updatePricing(-5, 20);
      }).toThrow('Prices must be positive');

      expect(() => {
        product.updatePricing(20, 15);
      }).toThrow('Recommended price must be higher than supplier price');
    });
  });

  describe('analysis', () => {
    it('should generate product analysis', () => {
      const product = new Product(validProductData);
      const analysis = product.getAnalysis();
      
      expect(analysis.contentScore).toBe(75);
      expect(analysis.marginAnalysis.margin).toBe(20);
      expect(analysis.competitorCount).toBe(15);
      expect(analysis.recommendation).toBe('proceed');
    });

    it('should recommend rejection for high-risk products', () => {
      const highRiskProduct = new Product({
        ...validProductData,
        contentScore: 30,
        competitorCount: 40,
        recommendedPrice: 12,
        margin: 2,
      });
      
      const analysis = highRiskProduct.getAnalysis();
      expect(analysis.recommendation).toBe('reject');
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON correctly', () => {
      const product = new Product(validProductData);
      const json = product.toJSON();
      
      expect(json.name).toBe(validProductData.name);
      expect(json.supplierPrice).toBe(validProductData.supplierPrice);
      expect(json.id).toBeDefined();
    });

    it('should create from JSON correctly', () => {
      const product = new Product(validProductData);
      const json = product.toJSON();
      const recreated = Product.fromJSON(json);
      
      expect(recreated.name).toBe(product.name);
      expect(recreated.id).toBe(product.id);
      expect(recreated.margin).toBe(product.margin);
    });

    it('should validate data correctly', () => {
      expect(Product.validate(validProductData)).toBe(false); // Missing ID
      
      const product = new Product(validProductData);
      expect(Product.validate(product.toJSON())).toBe(true);
      
      expect(Product.validate({ invalid: 'data' })).toBe(false);
    });
  });
});