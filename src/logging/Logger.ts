import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  correlationId?: string;
  duration?: number;
}

export interface LoggerConfig {
  level: LogLevel;
  outputDir: string;
  consoleOutput: boolean;
  fileOutput: boolean;
  maxFileSize: number; // in bytes
  maxFiles: number;
  structuredLogging: boolean;
}

export class Logger {
  private config: LoggerConfig;
  private currentLogFile: string;
  private logStream: fs.WriteStream | null = null;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private handleProcessExit: () => void = () => {};

  constructor(config: Partial<LoggerConfig> = {}) {
    // Ensure outputDir is properly resolved
    const defaultOutputDir = config.outputDir || path.join(__dirname, '../../logs');
    
    this.config = {
      level: LogLevel.INFO,
      outputDir: path.resolve(defaultOutputDir),
      consoleOutput: true,
      fileOutput: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      structuredLogging: true,
      ...config
    };
    
    // Ensure outputDir is absolute
    if (config.outputDir) {
      this.config.outputDir = path.resolve(config.outputDir);
    }

    this.currentLogFile = this.getLogFileName();
    this.initializeLogger();
  }

  private initializeLogger(): void {
    // Create log directory if it doesn't exist
    if (this.config.fileOutput && !fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }

    // Initialize log stream
    if (this.config.fileOutput) {
      this.createLogStream();
    }

    // Set up flush interval
    this.flushInterval = setInterval(() => this.flush(), 5000);

    // Create bound methods for process event handlers
    this.handleProcessExit = this.close.bind(this);
    
    // Handle process termination
    process.on('exit', this.handleProcessExit);
    process.on('SIGINT', this.handleProcessExit);
    process.on('SIGTERM', this.handleProcessExit);
  }

  private createLogStream(): void {
    // Ensure directory exists before creating stream
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
    
    const logPath = path.join(this.config.outputDir, this.currentLogFile);
    this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
    
    this.logStream.on('error', (err) => {
      console.error('Error writing to log file:', err);
      this.logStream = null;
    });
  }

  private getLogFileName(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];
    return `agent-${dateStr}.log`;
  }

  private shouldRotate(): boolean {
    if (!this.config.fileOutput || !this.logStream) return false;

    const logPath = path.join(this.config.outputDir, this.currentLogFile);
    try {
      const stats = fs.statSync(logPath);
      return stats.size >= this.config.maxFileSize;
    } catch {
      return false;
    }
  }

  private rotateLogFile(): void {
    if (this.logStream) {
      this.logStream.end();
    }

    // Clean up old log files
    this.cleanupOldLogs();

    // Create new log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = `agent-${timestamp}.log`;
    this.createLogStream();
  }

  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.config.outputDir)
        .filter(f => f.startsWith('agent-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.config.outputDir, f),
          mtime: fs.statSync(path.join(this.config.outputDir, f)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Remove oldest files if we exceed maxFiles
      if (files.length >= this.config.maxFiles) {
        files.slice(this.config.maxFiles - 1).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (err) {
      console.error('Error cleaning up old logs:', err);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.config.structuredLogging) {
      return JSON.stringify({
        ...entry,
        timestamp: entry.timestamp.toISOString(),
        level: LogLevel[entry.level]
      }) + '\n';
    } else {
      const timestamp = entry.timestamp.toISOString();
      const level = LogLevel[entry.level].padEnd(8);
      const category = entry.category.padEnd(20);
      let message = `${timestamp} ${level} ${category} ${entry.message}`;
      
      if (entry.data) {
        message += ` ${JSON.stringify(entry.data)}`;
      }
      
      return message + '\n';
    }
  }

  private writeLog(entry: LogEntry): void {
    // Check log level
    if (entry.level < this.config.level) {
      return;
    }

    // Add to buffer
    this.logBuffer.push(entry);

    // Console output
    if (this.config.consoleOutput) {
      this.logToConsole(entry);
    }

    // Flush if buffer is getting large
    if (this.logBuffer.length >= 100) {
      this.flush();
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelColor = this.getLevelColor(entry.level);
    const level = LogLevel[entry.level];
    
    let message = `${timestamp} ${levelColor}${level}${this.resetColor()} [${entry.category}] ${entry.message}`;
    
    if (entry.data) {
      message += '\n' + JSON.stringify(entry.data, null, 2);
    }

    switch (entry.level) {
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  }

  private getLevelColor(level: LogLevel): string {
    if (process.env.NO_COLOR) return '';
    
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
      case LogLevel.INFO: return '\x1b[32m';  // Green
      case LogLevel.WARN: return '\x1b[33m';  // Yellow
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      case LogLevel.CRITICAL: return '\x1b[35m'; // Magenta
      default: return '';
    }
  }

  private resetColor(): string {
    return process.env.NO_COLOR ? '' : '\x1b[0m';
  }

  private flush(): void {
    if (this.logBuffer.length === 0) return;

    // Check if we need to rotate
    if (this.shouldRotate()) {
      this.rotateLogFile();
    }

    // Write to file
    if (this.config.fileOutput) {
      if (!this.logStream || this.logStream.destroyed) {
        // Try to recreate the stream if it's destroyed
        this.createLogStream();
      }
      
      if (this.logStream && !this.logStream.destroyed) {
        const entries = this.logBuffer.splice(0);
        entries.forEach(entry => {
          const formatted = this.formatLogEntry(entry);
          this.logStream!.write(formatted);
        });
      }
    } else {
      // Clear buffer even if we can't write
      this.logBuffer = [];
    }
  }

  // Public logging methods
  public debug(category: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, category, message, data);
  }

  public info(category: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, category, message, data);
  }

  public warn(category: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, category, message, data);
  }

  public error(category: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, category, message, data);
  }

  public critical(category: string, message: string, data?: any): void {
    this.log(LogLevel.CRITICAL, category, message, data);
  }

  public log(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data
    };

    this.writeLog(entry);
  }

  // Structured logging for specific events
  public logDecision(decision: {
    action: string;
    reasoning: string;
    confidence: number;
    outcome?: string;
    context?: any;
  }): void {
    this.info('DECISION', decision.action, {
      reasoning: decision.reasoning,
      confidence: decision.confidence,
      outcome: decision.outcome,
      context: decision.context
    });
  }

  public logFinancialTransaction(transaction: {
    type: 'revenue' | 'expense' | 'adjustment' | 'fee';
    amount: number;
    description: string;
    campaignId?: string;
    productId?: string;
  }): void {
    this.info('FINANCIAL', `${transaction.type}: $${transaction.amount.toFixed(2)}`, {
      description: transaction.description,
      campaignId: transaction.campaignId,
      productId: transaction.productId
    });
  }

  public logPerformanceMetric(metric: {
    name: string;
    value: number;
    unit?: string;
    context?: any;
  }): void {
    this.info('PERFORMANCE', `${metric.name}: ${metric.value}${metric.unit || ''}`, {
      context: metric.context
    });
  }

  public startTimer(operation: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug('TIMING', `${operation} completed`, { duration });
    };
  }

  // Query methods
  public async searchLogs(criteria: {
    startDate?: Date;
    endDate?: Date;
    level?: LogLevel;
    category?: string;
    searchText?: string;
  }): Promise<LogEntry[]> {
    const results: LogEntry[] = [];
    
    // Search through log files
    const files = fs.readdirSync(this.config.outputDir)
      .filter(f => f.startsWith('agent-') && f.endsWith('.log'))
      .sort();

    for (const file of files) {
      const filePath = path.join(this.config.outputDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const entry = this.config.structuredLogging 
            ? JSON.parse(line)
            : this.parseUnstructuredLog(line);

          if (this.matchesCriteria(entry, criteria)) {
            results.push(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }
    }

    return results;
  }

  private parseUnstructuredLog(line: string): LogEntry {
    // Basic parsing for unstructured logs
    const parts = line.split(' ');
    const timestamp = new Date(parts[0]);
    const level = LogLevel[parts[1] as keyof typeof LogLevel] || LogLevel.INFO;
    const category = parts[2];
    const message = parts.slice(3).join(' ');

    return { timestamp, level, category, message };
  }

  private matchesCriteria(entry: LogEntry, criteria: any): boolean {
    if (criteria.startDate && entry.timestamp < criteria.startDate) return false;
    if (criteria.endDate && entry.timestamp > criteria.endDate) return false;
    if (criteria.level !== undefined && entry.level < criteria.level) return false;
    if (criteria.category && entry.category !== criteria.category) return false;
    if (criteria.searchText && !entry.message.includes(criteria.searchText)) return false;
    
    return true;
  }

  public async closeAndWait(): Promise<void> {
    // Flush remaining logs
    this.flush();

    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Close stream and wait for it to finish
    if (this.logStream && !this.logStream.destroyed) {
      await new Promise<void>((resolve) => {
        this.logStream!.end(() => resolve());
      });
      this.logStream = null;
    }
    
    // Remove process event listeners
    process.removeListener('exit', this.handleProcessExit);
    process.removeListener('SIGINT', this.handleProcessExit);
    process.removeListener('SIGTERM', this.handleProcessExit);
  }
  
  public close(): void {
    // Flush remaining logs
    this.flush();

    // Clear interval
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Close stream
    if (this.logStream && !this.logStream.destroyed) {
      this.logStream.end();
      this.logStream = null;
    }
    
    // Remove process event listeners
    process.removeListener('exit', this.handleProcessExit);
    process.removeListener('SIGINT', this.handleProcessExit);
    process.removeListener('SIGTERM', this.handleProcessExit);
  }

  // Get logger stats
  public getStats(): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByCategory: Record<string, number>;
  } {
    const stats = {
      totalLogs: 0,
      logsByLevel: {} as Record<string, number>,
      logsByCategory: {} as Record<string, number>
    };

    // This would be more efficient with a proper database
    // For now, just return buffer stats
    this.logBuffer.forEach(entry => {
      stats.totalLogs++;
      
      const levelName = LogLevel[entry.level];
      stats.logsByLevel[levelName] = (stats.logsByLevel[levelName] || 0) + 1;
      stats.logsByCategory[entry.category] = (stats.logsByCategory[entry.category] || 0) + 1;
    });

    return stats;
  }
}