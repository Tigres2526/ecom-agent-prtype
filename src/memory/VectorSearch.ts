import OpenAI from 'openai';
import type { MemoryEntry, MemorySearchResult } from '../types/index.js';
import { apiConfig } from '../config/environment.js';

/**
 * Vector-based semantic search for memory entries
 */
export class VectorSearch {
  private openai: OpenAI;
  private vectorDatabase: Array<MemoryEntry & { embedding: number[] }>;
  private maxVectorEntries: number;

  constructor(maxVectorEntries: number = 5000) {
    this.openai = new OpenAI({
      apiKey: apiConfig.openai.apiKey,
      baseURL: apiConfig.openai.baseURL,
    });
    this.vectorDatabase = [];
    this.maxVectorEntries = maxVectorEntries;
  }

  /**
   * Generates embedding for text using OpenAI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: apiConfig.openai.embeddingModel,
        input: text.substring(0, apiConfig.openai.maxEmbeddingTokens * 4), // Rough token limit
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Calculates cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Stores a memory entry with its vector embedding
   */
  public async storeVector(entry: MemoryEntry): Promise<void> {
    try {
      // Create searchable text from entry
      const searchableText = `${entry.key} ${entry.value}`;
      const embedding = await this.generateEmbedding(searchableText);

      const vectorEntry = {
        ...entry,
        embedding,
      };

      // Check if entry already exists (by key)
      const existingIndex = this.vectorDatabase.findIndex(e => e.key === entry.key);
      if (existingIndex !== -1) {
        this.vectorDatabase[existingIndex] = vectorEntry;
      } else {
        this.vectorDatabase.push(vectorEntry);
      }

      // Enforce size limits
      this.enforceVectorLimits();
    } catch (error) {
      console.error('Error storing vector:', error);
      // Don't throw - vector storage is optional
    }
  }

  /**
   * Searches for similar memory entries using semantic similarity
   */
  public async searchSimilar(query: string, limit: number = 5, minSimilarity: number = 0.7): Promise<MemorySearchResult[]> {
    if (this.vectorDatabase.length === 0) {
      return [];
    }

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const results: MemorySearchResult[] = [];

      for (const entry of this.vectorDatabase) {
        const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
        
        if (similarity >= minSimilarity) {
          results.push({
            entry: {
              key: entry.key,
              value: entry.value,
              timestamp: entry.timestamp,
              day: entry.day,
              type: entry.type,
              metadata: entry.metadata,
            },
            similarity,
            relevance: this.calculateRelevance(entry, similarity),
          });
        }
      }

      // Sort by relevance (combination of similarity and recency)
      results.sort((a, b) => b.relevance - a.relevance);

      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching vectors:', error);
      return [];
    }
  }

  /**
   * Calculates relevance score combining similarity and recency
   */
  private calculateRelevance(entry: MemoryEntry, similarity: number): number {
    // Recency factor (newer entries get higher scores)
    const now = new Date().getTime();
    const entryTime = entry.timestamp.getTime();
    const daysSinceEntry = (now - entryTime) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.exp(-daysSinceEntry / 30); // Decay over 30 days

    // Type importance factor
    const typeWeights = {
      decision: 1.0,
      insight: 0.9,
      metric: 0.7,
      error: 0.5,
    };
    const typeFactor = typeWeights[entry.type] || 0.8;

    // Combined relevance score
    return similarity * 0.7 + recencyFactor * 0.2 + typeFactor * 0.1;
  }

  /**
   * Searches by entry type with semantic similarity
   */
  public async searchByType(query: string, type: MemoryEntry['type'], limit: number = 5): Promise<MemorySearchResult[]> {
    const allResults = await this.searchSimilar(query, limit * 2, 0.5);
    return allResults
      .filter(result => result.entry.type === type)
      .slice(0, limit);
  }

  /**
   * Searches recent entries with semantic similarity
   */
  public async searchRecent(query: string, days: number = 7, limit: number = 5): Promise<MemorySearchResult[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const allResults = await this.searchSimilar(query, limit * 2, 0.5);
    return allResults
      .filter(result => result.entry.timestamp >= cutoffDate)
      .slice(0, limit);
  }

  /**
   * Gets entries similar to a given entry
   */
  public async findSimilarEntries(entry: MemoryEntry, limit: number = 5): Promise<MemorySearchResult[]> {
    const searchText = `${entry.key} ${entry.value}`;
    const results = await this.searchSimilar(searchText, limit + 1, 0.6);
    
    // Filter out the original entry
    return results.filter(result => result.entry.key !== entry.key);
  }

  /**
   * Removes entry from vector database
   */
  public removeVector(key: string): boolean {
    const index = this.vectorDatabase.findIndex(entry => entry.key === key);
    if (index !== -1) {
      this.vectorDatabase.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Prunes old vector entries
   */
  public pruneOldVectors(daysToKeep: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const initialLength = this.vectorDatabase.length;
    this.vectorDatabase = this.vectorDatabase.filter(
      entry => entry.timestamp >= cutoffDate || entry.type === 'insight'
    );
    
    return initialLength - this.vectorDatabase.length;
  }

  /**
   * Enforces vector database size limits
   */
  private enforceVectorLimits(): void {
    if (this.vectorDatabase.length > this.maxVectorEntries) {
      // Sort by relevance (keeping most relevant entries)
      const now = new Date();
      this.vectorDatabase.sort((a, b) => {
        const relevanceA = this.calculateRelevance(a, 1.0);
        const relevanceB = this.calculateRelevance(b, 1.0);
        return relevanceB - relevanceA;
      });

      // Keep only the most relevant entries
      this.vectorDatabase = this.vectorDatabase.slice(0, this.maxVectorEntries);
    }
  }

  /**
   * Gets vector database statistics
   */
  public getVectorStats(): {
    totalVectors: number;
    maxVectors: number;
    utilizationPercent: number;
    typeDistribution: Record<string, number>;
    averageAge: number;
  } {
    const typeDistribution: Record<string, number> = {};
    let totalAge = 0;
    const now = new Date().getTime();

    for (const entry of this.vectorDatabase) {
      typeDistribution[entry.type] = (typeDistribution[entry.type] || 0) + 1;
      totalAge += (now - entry.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    }

    return {
      totalVectors: this.vectorDatabase.length,
      maxVectors: this.maxVectorEntries,
      utilizationPercent: (this.vectorDatabase.length / this.maxVectorEntries) * 100,
      typeDistribution,
      averageAge: this.vectorDatabase.length > 0 ? totalAge / this.vectorDatabase.length : 0,
    };
  }

  /**
   * Clears all vectors
   */
  public clearVectors(): void {
    this.vectorDatabase = [];
  }

  /**
   * Exports vector database
   */
  public exportVectors(): Array<MemoryEntry & { embedding: number[] }> {
    return [...this.vectorDatabase];
  }

  /**
   * Imports vector database
   */
  public importVectors(vectors: Array<MemoryEntry & { embedding: number[] }>): void {
    this.vectorDatabase = [...vectors];
    this.enforceVectorLimits();
  }

  /**
   * Rebuilds embeddings for all entries (useful after model changes)
   */
  public async rebuildEmbeddings(): Promise<void> {
    const entries = this.vectorDatabase.map(entry => ({
      key: entry.key,
      value: entry.value,
      timestamp: entry.timestamp,
      day: entry.day,
      type: entry.type,
      metadata: entry.metadata,
    }));

    this.clearVectors();

    for (const entry of entries) {
      await this.storeVector(entry);
    }
  }
}