import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from './ContextManager.js';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager(1000, 100); // Small limits for testing
  });

  describe('basic message operations', () => {
    it('should add and retrieve messages', () => {
      contextManager.addSystemMessage('You are a dropshipping agent');
      contextManager.addUserMessage('What should I do today?');
      contextManager.addAssistantMessage('Let me analyze the situation');

      const messages = contextManager.getRecentContext();
      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[2].role).toBe('assistant');
    });

    it('should estimate tokens correctly', () => {
      contextManager.addUserMessage('This is a test message');
      
      const messages = contextManager.getRecentContext();
      expect(messages[0].tokens).toBeGreaterThan(0);
      
      const stats = contextManager.getStats();
      expect(stats.tokenCount).toBeGreaterThan(0);
    });

    it('should add tool calls and results', () => {
      const toolCalls = [{ name: 'search_products', parameters: { query: 'phone case' } }];
      const toolResults = [{ success: true, data: { products: [] } }];
      
      contextManager.addAssistantMessage('Searching for products', toolCalls);
      contextManager.addToolMessage('Found 5 products', toolResults);
      
      const messages = contextManager.getRecentContext();
      expect(messages[0].toolCalls).toEqual(toolCalls);
      expect(messages[1].toolResults).toEqual(toolResults);
    });
  });

  describe('token management', () => {
    it('should track token count accurately', () => {
      const initialStats = contextManager.getStats();
      expect(initialStats.tokenCount).toBe(0);
      
      contextManager.addUserMessage('Short message');
      const afterFirstMessage = contextManager.getStats();
      expect(afterFirstMessage.tokenCount).toBeGreaterThan(0);
      
      contextManager.addUserMessage('This is a longer message with more content');
      const afterSecondMessage = contextManager.getStats();
      expect(afterSecondMessage.tokenCount).toBeGreaterThan(afterFirstMessage.tokenCount);
    });

    it('should prune messages when approaching token limit', () => {
      const smallManager = new ContextManager(200, 50); // Very small limit
      
      // Override isImportantMessage to allow pruning in test
      const originalIsImportant = (smallManager as any).isImportantMessage;
      (smallManager as any).isImportantMessage = function(message: any) {
        // Only system messages are important for this test
        return message.role === 'system';
      };
      
      // Add many messages to exceed limit
      for (let i = 0; i < 20; i++) {
        smallManager.addUserMessage(`Message number ${i} with some content to use tokens`);
      }
      
      const stats = smallManager.getStats();
      expect(stats.tokenCount).toBeLessThanOrEqual(150); // 200 - 50 buffer
      expect(smallManager.getRecentContext().length).toBeLessThan(20);
      
      // Restore original method
      (smallManager as any).isImportantMessage = originalIsImportant;
    });

    it('should preserve important messages during pruning', () => {
      const smallManager = new ContextManager(300, 50);
      
      // Add system message (important)
      smallManager.addSystemMessage('You are an important system message');
      
      // Add many regular messages
      for (let i = 0; i < 15; i++) {
        smallManager.addUserMessage(`Regular message ${i}`);
      }
      
      // Add message with important keywords
      smallManager.addUserMessage('This is a critical decision about bankruptcy');
      
      const messages = smallManager.getRecentContext();
      
      // System message should be preserved
      expect(messages.some(m => m.role === 'system')).toBe(true);
      
      // Critical message should be preserved
      expect(messages.some(m => m.content.includes('critical decision'))).toBe(true);
    });
  });

  describe('context retrieval', () => {
    beforeEach(() => {
      contextManager.addSystemMessage('System prompt');
      contextManager.addUserMessage('User message 1');
      contextManager.addAssistantMessage('Assistant response 1');
      contextManager.addUserMessage('User message 2');
      contextManager.addAssistantMessage('Assistant response 2');
    });

    it('should get recent context with limit', () => {
      const recent = contextManager.getRecentContext(3);
      expect(recent).toHaveLength(3);
      
      // Should be the last 3 messages
      expect(recent[0].content).toBe('Assistant response 1');
      expect(recent[1].content).toBe('User message 2');
      expect(recent[2].content).toBe('Assistant response 2');
    });

    it('should format messages for Grok API', () => {
      const grokMessages = contextManager.getMessagesForGrok();
      
      expect(grokMessages).toHaveLength(5);
      expect(grokMessages[0]).toHaveProperty('role');
      expect(grokMessages[0]).toHaveProperty('content');
      
      // Should not have timestamp or tokens in Grok format
      expect(grokMessages[0]).not.toHaveProperty('timestamp');
      expect(grokMessages[0]).not.toHaveProperty('tokens');
    });

    it('should get last N messages', () => {
      const lastTwo = contextManager.getLastMessages(2);
      expect(lastTwo).toHaveLength(2);
      expect(lastTwo[0].content).toBe('User message 2');
      expect(lastTwo[1].content).toBe('Assistant response 2');
    });

    it('should get messages by role', () => {
      const userMessages = contextManager.getMessagesByRole('user');
      expect(userMessages).toHaveLength(2);
      expect(userMessages.every(m => m.role === 'user')).toBe(true);
      
      const systemMessages = contextManager.getMessagesByRole('system');
      expect(systemMessages).toHaveLength(1);
    });

    it('should search messages by content', () => {
      const searchResults = contextManager.searchMessages('message 1');
      expect(searchResults).toHaveLength(1); // Only User message 1 contains "message 1"
      
      const caseInsensitive = contextManager.searchMessages('USER');
      expect(caseInsensitive.length).toBeGreaterThan(0);
      
      const caseSensitive = contextManager.searchMessages('USER', true);
      expect(caseSensitive).toHaveLength(0);
    });

    it('should get messages by time range', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const oneMinuteLater = new Date(now.getTime() + 60000);
      
      const recentMessages = contextManager.getMessagesByTimeRange(oneMinuteAgo, oneMinuteLater);
      expect(recentMessages).toHaveLength(5); // All messages should be recent
      
      const farFuture = new Date(now.getTime() + 120000); // 2 minutes in future
      const futureMessages = contextManager.getMessagesByTimeRange(oneMinuteLater, farFuture);
      expect(futureMessages).toHaveLength(0);
    });
  });

  describe('context optimization', () => {
    it('should remove duplicate consecutive messages', () => {
      contextManager.addUserMessage('Same message');
      contextManager.addUserMessage('Same message');
      contextManager.addUserMessage('Different message');
      contextManager.addUserMessage('Same message');
      
      const beforeOptimization = contextManager.getStats().messageCount;
      const removedCount = contextManager.optimize();
      const afterOptimization = contextManager.getStats().messageCount;
      
      expect(removedCount).toBe(1); // One duplicate removed
      expect(afterOptimization).toBe(beforeOptimization - 1);
    });

    it('should summarize old messages', async () => {
      // Add many messages
      for (let i = 0; i < 10; i++) {
        contextManager.addUserMessage(`Message ${i}`);
        contextManager.addAssistantMessage(`Response ${i}`);
      }
      
      const beforeSummary = contextManager.getStats().messageCount;
      await contextManager.summarizeOldMessages(5); // Keep last 5
      const afterSummary = contextManager.getStats().messageCount;
      
      expect(afterSummary).toBeLessThan(beforeSummary);
      expect(afterSummary).toBe(6); // 5 kept + 1 summary message
      
      // Should have a summary message
      const messages = contextManager.getRecentContext();
      expect(messages.some(m => m.content.includes('Context Summary'))).toBe(true);
    });
  });

  describe('statistics and monitoring', () => {
    beforeEach(() => {
      contextManager.addSystemMessage('System');
      contextManager.addUserMessage('User');
      contextManager.addAssistantMessage('Assistant');
    });

    it('should provide comprehensive statistics', () => {
      const stats = contextManager.getStats();
      
      expect(stats.messageCount).toBe(3);
      expect(stats.tokenCount).toBeGreaterThan(0);
      expect(stats.maxTokens).toBe(1000);
      expect(stats.utilizationPercent).toBeGreaterThan(0);
      expect(stats.availableTokens).toBeGreaterThan(0);
      expect(stats.oldestMessage).toBeInstanceOf(Date);
      expect(stats.newestMessage).toBeInstanceOf(Date);
      expect(stats.messagesByRole).toHaveProperty('system', 1);
      expect(stats.messagesByRole).toHaveProperty('user', 1);
      expect(stats.messagesByRole).toHaveProperty('assistant', 1);
    });

    it('should detect near capacity', () => {
      expect(contextManager.isNearCapacity(0.8)).toBe(false);
      
      // Fill up context
      const smallManager = new ContextManager(100, 10);
      for (let i = 0; i < 10; i++) {
        smallManager.addUserMessage('This is a longer message to fill up the context window');
      }
      
      expect(smallManager.isNearCapacity(0.5)).toBe(true);
    });
  });

  describe('import/export', () => {
    beforeEach(() => {
      contextManager.addSystemMessage('System message');
      contextManager.addUserMessage('User message');
      contextManager.addAssistantMessage('Assistant message');
    });

    it('should export context data', () => {
      const exported = contextManager.export();
      
      expect(exported.messages).toHaveLength(3);
      expect(exported.maxTokens).toBe(1000);
      expect(exported.tokenBuffer).toBe(100);
      expect(exported.currentTokenCount).toBeGreaterThan(0);
      expect(exported.exportedAt).toBeInstanceOf(Date);
    });

    it('should import context data', () => {
      const exported = contextManager.export();
      
      const newManager = new ContextManager();
      newManager.import(exported);
      
      const newStats = newManager.getStats();
      const originalStats = contextManager.getStats();
      
      expect(newStats.messageCount).toBe(originalStats.messageCount);
      expect(newStats.tokenCount).toBe(originalStats.tokenCount);
      
      const newMessages = newManager.getRecentContext();
      const originalMessages = contextManager.getRecentContext();
      
      expect(newMessages).toHaveLength(originalMessages.length);
      expect(newMessages[0].content).toBe(originalMessages[0].content);
    });

    it('should clear all messages', () => {
      expect(contextManager.getStats().messageCount).toBe(3);
      
      contextManager.clear();
      
      expect(contextManager.getStats().messageCount).toBe(0);
      expect(contextManager.getStats().tokenCount).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', () => {
      contextManager.addUserMessage('');
      
      const stats = contextManager.getStats();
      expect(stats.messageCount).toBe(1);
      expect(stats.tokenCount).toBeGreaterThan(0); // Still has overhead
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(10000);
      contextManager.addUserMessage(longMessage);
      
      const stats = contextManager.getStats();
      expect(stats.tokenCount).toBeGreaterThan(2000); // Should be roughly 2500 tokens
    });

    it('should handle messages with complex tool calls', () => {
      const complexToolCall = {
        name: 'complex_tool',
        parameters: {
          nested: {
            data: ['array', 'of', 'values'],
            number: 42,
            boolean: true,
          },
        },
      };
      
      contextManager.addAssistantMessage('Using complex tool', [complexToolCall]);
      
      const messages = contextManager.getRecentContext();
      expect(messages[0].toolCalls).toEqual([complexToolCall]);
      expect(messages[0].tokens).toBeGreaterThan(50); // Should account for tool call complexity
    });

    it('should maintain chronological order after pruning', () => {
      const timestamps: Date[] = [];
      
      // Add messages with slight delays to ensure different timestamps
      for (let i = 0; i < 5; i++) {
        contextManager.addUserMessage(`Message ${i}`);
        timestamps.push(new Date());
      }
      
      const messages = contextManager.getRecentContext();
      
      // Verify chronological order
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          messages[i - 1].timestamp.getTime()
        );
      }
    });
  });
});