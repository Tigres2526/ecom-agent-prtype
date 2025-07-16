import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AuditTrail } from './AuditTrail.js';
import { Logger } from './Logger.js';

describe('AuditTrail', () => {
  let auditTrail: AuditTrail;
  let logger: Logger;
  const testAuditDir = path.join(process.cwd(), 'test-audit');

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testAuditDir)) {
      fs.rmSync(testAuditDir, { recursive: true, force: true });
    }

    logger = new Logger({ consoleOutput: false, fileOutput: false });
    auditTrail = new AuditTrail(logger, testAuditDir);
  });

  afterEach(() => {
    auditTrail.close();
    logger.close();
    
    // Clean up test directory
    if (fs.existsSync(testAuditDir)) {
      fs.rmSync(testAuditDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create audit directory if it does not exist', () => {
      expect(fs.existsSync(testAuditDir)).toBe(true);
    });

    it('should create audit file with correct naming format', async () => {
      // Write a test entry to ensure file is created
      auditTrail.auditSystemEvent('test', { data: 'test' });
      await auditTrail.closeAndWait();
      
      const files = fs.readdirSync(testAuditDir);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^audit-\d{4}-\d{2}\.jsonl$/);
    });
  });

  describe('financial auditing', () => {
    it('should audit financial transactions', async () => {
      auditTrail.auditFinancialTransaction({
        transactionId: 'txn_123',
        type: 'revenue',
        amount: 100.50,
        currency: 'USD',
        description: 'Product sale',
        campaignId: 'camp_456',
        productId: 'prod_789',
        balance: {
          before: 1000,
          after: 1100.50
        }
      });

      // Close to flush
      await auditTrail.closeAndWait();

      const files = fs.readdirSync(testAuditDir);
      const content = fs.readFileSync(path.join(testAuditDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.action).toBe('FINANCIAL_REVENUE');
      expect(entry.category).toBe('financial');
      expect(entry.details.amount).toBe(100.50);
      expect(entry.previousState.balance).toBe(1000);
      expect(entry.newState.balance).toBe(1100.50);
    });

    it('should maintain hash chain for financial transactions', async () => {
      auditTrail.auditFinancialTransaction({
        transactionId: 'txn_1',
        type: 'expense',
        amount: 50,
        currency: 'USD',
        description: 'Ad spend',
        balance: { before: 1000, after: 950 }
      });

      auditTrail.auditFinancialTransaction({
        transactionId: 'txn_2',
        type: 'revenue',
        amount: 100,
        currency: 'USD',
        description: 'Sale',
        balance: { before: 950, after: 1050 }
      });

      await auditTrail.closeAndWait();

      const files = fs.readdirSync(testAuditDir);
      const content = fs.readFileSync(path.join(testAuditDir, files[0]), 'utf-8');
      const lines = content.trim().split('\n');
      
      const entry1 = JSON.parse(lines[0]);
      const entry2 = JSON.parse(lines[1]);

      expect(entry2.previousHash).toBe(entry1.hash);
    });
  });

  describe('decision auditing', () => {
    it('should audit decisions', () => {
      auditTrail.auditDecision({
        decisionId: 'dec_123',
        type: 'campaign_creation',
        reasoning: 'High potential product with good margins',
        confidence: 0.85,
        alternatives: ['Wait for more data', 'Test with smaller budget'],
        outcome: 'Campaign created successfully',
        impact: {
          financial: -50,
          campaigns: ['camp_new']
        }
      });

      auditTrail.close();

      const files = fs.readdirSync(testAuditDir);
      const content = fs.readFileSync(path.join(testAuditDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.action).toBe('DECISION_CAMPAIGN_CREATION');
      expect(entry.category).toBe('decision');
      expect(entry.details.confidence).toBe(0.85);
      expect(entry.details.alternatives).toHaveLength(2);
      expect(entry.newState.impact.financial).toBe(-50);
    });
  });

  describe('campaign auditing', () => {
    it('should audit campaign actions', () => {
      auditTrail.auditCampaignAction('create', 'camp_123', {
        platform: 'facebook',
        budget: 100,
        targetAudience: 'US 18-35'
      });

      auditTrail.close();

      const files = fs.readdirSync(testAuditDir);
      const content = fs.readFileSync(path.join(testAuditDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.action).toBe('CAMPAIGN_CREATE');
      expect(entry.details.campaignId).toBe('camp_123');
      expect(entry.details.platform).toBe('facebook');
    });
  });

  describe('product auditing', () => {
    it('should audit product actions', () => {
      auditTrail.auditProductAction('research', 'prod_456', {
        source: 'aliexpress',
        price: 15.99,
        estimatedMargin: 0.65
      });

      auditTrail.close();

      const files = fs.readdirSync(testAuditDir);
      const content = fs.readFileSync(path.join(testAuditDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.action).toBe('PRODUCT_RESEARCH');
      expect(entry.details.productId).toBe('prod_456');
      expect(entry.details.estimatedMargin).toBe(0.65);
    });
  });

  describe('system auditing', () => {
    it('should audit system events', () => {
      auditTrail.auditSystemEvent('startup', {
        version: '1.0.0',
        config: { maxDays: 200, initialCapital: 500 }
      });

      auditTrail.close();

      const files = fs.readdirSync(testAuditDir);
      const content = fs.readFileSync(path.join(testAuditDir, files[0]), 'utf-8');
      const entry = JSON.parse(content.trim());

      expect(entry.action).toBe('SYSTEM_STARTUP');
      expect(entry.actor).toBe('SYSTEM');
      expect(entry.details.version).toBe('1.0.0');
    });
  });

  describe('search functionality', () => {
    beforeEach(() => {
      // Add various audit entries
      auditTrail.auditFinancialTransaction({
        transactionId: 'txn_1',
        type: 'revenue',
        amount: 100,
        currency: 'USD',
        description: 'Sale 1',
        balance: { before: 1000, after: 1100 }
      });

      auditTrail.auditDecision({
        decisionId: 'dec_1',
        type: 'scale_campaign',
        reasoning: 'Good performance',
        confidence: 0.9
      });

      auditTrail.auditCampaignAction('kill', 'camp_1', {
        reason: 'Poor performance'
      });

      auditTrail.close();
    });

    it('should search by category', async () => {
      const results = await auditTrail.searchAuditTrail({
        category: 'financial'
      });

      expect(results).toHaveLength(1);
      expect(results[0].category).toBe('financial');
    });

    it('should search by action', async () => {
      const results = await auditTrail.searchAuditTrail({
        action: 'CAMPAIGN'
      });

      expect(results).toHaveLength(1);
      expect(results[0].action).toContain('CAMPAIGN');
    });

    it('should search by text', async () => {
      const results = await auditTrail.searchAuditTrail({
        searchText: 'performance'
      });

      expect(results).toHaveLength(2); // Decision and campaign both mention performance
    });

    it('should search by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const results = await auditTrail.searchAuditTrail({
        startDate: yesterday,
        endDate: tomorrow
      });

      expect(results).toHaveLength(3); // All entries from today
    });
  });

  describe('integrity verification', () => {
    it('should verify valid audit trail', async () => {
      auditTrail.auditSystemEvent('test1', { data: 'value1' });
      auditTrail.auditSystemEvent('test2', { data: 'value2' });
      auditTrail.close();

      const result = await auditTrail.verifyIntegrity();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.entriesChecked).toBe(2);
    });

    it('should detect tampered entries', async () => {
      auditTrail.auditSystemEvent('test', { data: 'original' });
      auditTrail.close();

      // Tamper with the file
      const files = fs.readdirSync(testAuditDir);
      const filePath = path.join(testAuditDir, files[0]);
      let content = fs.readFileSync(filePath, 'utf-8');
      let entry = JSON.parse(content.trim());
      
      // Change the data but keep the same hash
      entry.details.data = 'tampered';
      fs.writeFileSync(filePath, JSON.stringify(entry) + '\n');

      const result = await auditTrail.verifyIntegrity();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Hash mismatch');
    });
  });

  describe('report generation', () => {
    beforeEach(() => {
      // Add various entries for reporting
      auditTrail.auditFinancialTransaction({
        transactionId: 'txn_1',
        type: 'revenue',
        amount: 200,
        currency: 'USD',
        description: 'Sale',
        balance: { before: 1000, after: 1200 }
      });

      auditTrail.auditFinancialTransaction({
        transactionId: 'txn_2',
        type: 'expense',
        amount: 50,
        currency: 'USD',
        description: 'Ad spend',
        balance: { before: 1200, after: 1150 }
      });

      auditTrail.auditDecision({
        decisionId: 'dec_1',
        type: 'create_campaign',
        reasoning: 'Test',
        confidence: 0.8
      });

      auditTrail.close();
    });

    it('should generate audit report with summary', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const report = await auditTrail.generateReport(yesterday, now);

      expect(report.summary.totalEntries).toBe(3);
      expect(report.byCategory.financial).toBe(2);
      expect(report.byCategory.decision).toBe(1);
      expect(report.financialSummary?.totalRevenue).toBe(200);
      expect(report.financialSummary?.totalExpenses).toBe(50);
      expect(report.financialSummary?.netChange).toBe(150);
    });
  });

  describe('export functionality', () => {
    it('should export audit trail to file', async () => {
      auditTrail.auditSystemEvent('test_export', { data: 'export_test' });
      auditTrail.close();

      const exportPath = path.join(testAuditDir, 'export.json');
      await auditTrail.exportAuditTrail(exportPath);

      expect(fs.existsSync(exportPath)).toBe(true);
      
      const exportContent = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
      expect(exportContent.entriesCount).toBe(1);
      expect(exportContent.entries).toHaveLength(1);
      expect(exportContent.entries[0].details.data).toBe('export_test');
    });
  });
});