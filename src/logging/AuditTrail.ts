import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Logger } from './Logger.js';

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  category: 'financial' | 'decision' | 'campaign' | 'product' | 'system';
  actor: string; // Usually 'AI_AGENT' or specific component
  details: any;
  previousState?: any;
  newState?: any;
  hash: string;
  previousHash?: string;
}

export interface FinancialAuditData {
  transactionId: string;
  type: 'revenue' | 'expense' | 'fee' | 'adjustment';
  amount: number;
  currency: string;
  description: string;
  campaignId?: string;
  productId?: string;
  balance: {
    before: number;
    after: number;
  };
}

export interface DecisionAuditData {
  decisionId: string;
  type: string;
  reasoning: string;
  confidence: number;
  alternatives?: string[];
  outcome?: string;
  impact?: {
    financial?: number;
    campaigns?: string[];
    products?: string[];
  };
}

export class AuditTrail {
  private logger: Logger;
  private auditDir: string;
  private currentFile: string;
  private entries: AuditEntry[] = [];
  private lastHash: string = '';
  private writeStream: fs.WriteStream | null = null;

  constructor(logger: Logger, auditDir?: string) {
    this.logger = logger;
    this.auditDir = path.resolve(auditDir || path.join(process.cwd(), 'audit'));
    this.currentFile = this.getAuditFileName();
    
    this.initializeAuditTrail();
  }

  private initializeAuditTrail(): void {
    // Create audit directory if it doesn't exist
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }

    // Load existing audit entries to get last hash
    this.loadExistingEntries();

    // Create write stream
    const filePath = path.join(this.auditDir, this.currentFile);
    this.writeStream = fs.createWriteStream(filePath, { flags: 'a' });
    
    this.logger.info('AUDIT', 'Audit trail initialized', { 
      directory: this.auditDir,
      file: this.currentFile 
    });
  }

  private getAuditFileName(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `audit-${year}-${month}.jsonl`;
  }

  private loadExistingEntries(): void {
    const filePath = path.join(this.auditDir, this.currentFile);
    
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        
        if (lines.length > 0) {
          const lastEntry = JSON.parse(lines[lines.length - 1]);
          this.lastHash = lastEntry.hash;
        }
      } catch (err) {
        this.logger.error('AUDIT', 'Failed to load existing audit entries', err);
      }
    }
  }

  private generateHash(entry: Omit<AuditEntry, 'hash'>): string {
    const data = JSON.stringify({
      ...entry,
      previousHash: this.lastHash
    });
    
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  private createAuditEntry(
    action: string,
    category: AuditEntry['category'],
    actor: string,
    details: any,
    previousState?: any,
    newState?: any
  ): AuditEntry {
    const entry: Omit<AuditEntry, 'hash'> = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      category,
      actor,
      details,
      previousState,
      newState,
      previousHash: this.lastHash
    };

    const hash = this.generateHash(entry);
    
    return {
      ...entry,
      hash
    };
  }

  private writeEntry(entry: AuditEntry): void {
    // Write to file
    if (this.writeStream && !this.writeStream.destroyed) {
      this.writeStream.write(JSON.stringify(entry) + '\n');
    }

    // Update last hash
    this.lastHash = entry.hash;

    // Keep in memory (limited)
    this.entries.push(entry);
    if (this.entries.length > 1000) {
      this.entries.shift();
    }

    // Log to main logger
    this.logger.info('AUDIT', `${entry.category}: ${entry.action}`, {
      actor: entry.actor,
      id: entry.id
    });
  }

  // Financial transaction auditing
  public auditFinancialTransaction(data: FinancialAuditData): void {
    const entry = this.createAuditEntry(
      `FINANCIAL_${data.type.toUpperCase()}`,
      'financial',
      'AI_AGENT',
      {
        transactionId: data.transactionId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        campaignId: data.campaignId,
        productId: data.productId
      },
      { balance: data.balance.before },
      { balance: data.balance.after }
    );

    this.writeEntry(entry);
  }

  // Decision auditing
  public auditDecision(data: DecisionAuditData): void {
    const entry = this.createAuditEntry(
      `DECISION_${data.type.toUpperCase()}`,
      'decision',
      'AI_AGENT',
      {
        decisionId: data.decisionId,
        type: data.type,
        reasoning: data.reasoning,
        confidence: data.confidence,
        alternatives: data.alternatives
      },
      undefined,
      {
        outcome: data.outcome,
        impact: data.impact
      }
    );

    this.writeEntry(entry);
  }

  // Campaign auditing
  public auditCampaignAction(action: string, campaignId: string, details: any): void {
    const entry = this.createAuditEntry(
      `CAMPAIGN_${action.toUpperCase()}`,
      'campaign',
      'AI_AGENT',
      {
        campaignId,
        ...details
      }
    );

    this.writeEntry(entry);
  }

  // Product auditing
  public auditProductAction(action: string, productId: string, details: any): void {
    const entry = this.createAuditEntry(
      `PRODUCT_${action.toUpperCase()}`,
      'product',
      'AI_AGENT',
      {
        productId,
        ...details
      }
    );

    this.writeEntry(entry);
  }

  // System auditing
  public auditSystemEvent(event: string, details: any): void {
    const entry = this.createAuditEntry(
      `SYSTEM_${event.toUpperCase()}`,
      'system',
      'SYSTEM',
      details
    );

    this.writeEntry(entry);
  }

  // Query methods
  public async searchAuditTrail(criteria: {
    startDate?: Date;
    endDate?: Date;
    category?: AuditEntry['category'];
    action?: string;
    actor?: string;
    searchText?: string;
  }): Promise<AuditEntry[]> {
    const results: AuditEntry[] = [];
    
    // Search through audit files
    const files = fs.readdirSync(this.auditDir)
      .filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'))
      .sort();

    for (const file of files) {
      const filePath = path.join(this.auditDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line);

      for (const line of lines) {
        try {
          const entry: AuditEntry = JSON.parse(line);
          
          if (this.matchesCriteria(entry, criteria)) {
            results.push(entry);
          }
        } catch (err) {
          this.logger.error('AUDIT', 'Failed to parse audit entry', { line, error: err });
        }
      }
    }

    return results;
  }

  private matchesCriteria(entry: AuditEntry, criteria: any): boolean {
    const entryDate = new Date(entry.timestamp);
    
    if (criteria.startDate && entryDate < criteria.startDate) return false;
    if (criteria.endDate && entryDate > criteria.endDate) return false;
    if (criteria.category && entry.category !== criteria.category) return false;
    if (criteria.action && !entry.action.includes(criteria.action)) return false;
    if (criteria.actor && entry.actor !== criteria.actor) return false;
    
    if (criteria.searchText) {
      const searchableText = JSON.stringify(entry).toLowerCase();
      if (!searchableText.includes(criteria.searchText.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  }

  // Verify audit trail integrity
  public async verifyIntegrity(startDate?: Date, endDate?: Date): Promise<{
    valid: boolean;
    errors: string[];
    entriesChecked: number;
  }> {
    const errors: string[] = [];
    let entriesChecked = 0;
    let previousHash = '';

    const entries = await this.searchAuditTrail({ startDate, endDate });
    
    for (const entry of entries) {
      entriesChecked++;
      
      // Verify hash chain
      if (entry.previousHash !== undefined && entry.previousHash !== previousHash) {
        errors.push(`Hash chain broken at entry ${entry.id}`);
      }

      // Verify entry hash
      const entryWithoutHash = { ...entry };
      delete (entryWithoutHash as any).hash;
      const calculatedHash = this.generateHash(entryWithoutHash);
      
      if (calculatedHash !== entry.hash) {
        errors.push(`Hash mismatch for entry ${entry.id}`);
      }

      previousHash = entry.hash;
    }

    return {
      valid: errors.length === 0,
      errors,
      entriesChecked
    };
  }

  // Export audit trail
  public async exportAuditTrail(
    outputPath: string,
    criteria?: Parameters<typeof this.searchAuditTrail>[0]
  ): Promise<void> {
    const entries = await this.searchAuditTrail(criteria || {});
    
    const report = {
      exportDate: new Date(),
      criteria: criteria || {},
      entriesCount: entries.length,
      entries
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    
    this.logger.info('AUDIT', 'Audit trail exported', { 
      path: outputPath,
      entriesCount: entries.length 
    });
  }

  // Generate audit report
  public async generateReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: Record<string, number>;
    byCategory: Record<string, number>;
    byAction: Record<string, number>;
    financialSummary?: {
      totalRevenue: number;
      totalExpenses: number;
      netChange: number;
    };
  }> {
    const entries = await this.searchAuditTrail({ startDate, endDate });
    
    const summary: Record<string, number> = {
      totalEntries: entries.length,
      financialTransactions: 0,
      decisions: 0,
      campaigns: 0,
      products: 0,
      system: 0
    };

    const byCategory: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    
    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const entry of entries) {
      // Category counts
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      summary[`${entry.category}Transactions`] = (summary[`${entry.category}Transactions`] || 0) + 1;

      // Action counts
      byAction[entry.action] = (byAction[entry.action] || 0) + 1;

      // Financial summary
      if (entry.category === 'financial' && entry.details) {
        if (entry.details.type === 'revenue') {
          totalRevenue += entry.details.amount;
        } else if (entry.details.type === 'expense' || entry.details.type === 'fee') {
          totalExpenses += entry.details.amount;
        }
      }
    }

    return {
      summary,
      byCategory,
      byAction,
      financialSummary: {
        totalRevenue,
        totalExpenses,
        netChange: totalRevenue - totalExpenses
      }
    };
  }

  public async closeAndWait(): Promise<void> {
    if (this.writeStream) {
      await new Promise<void>((resolve) => {
        this.writeStream!.end(() => resolve());
      });
    }
  }
  
  public close(): void {
    if (this.writeStream) {
      this.writeStream.end();
    }
  }
}