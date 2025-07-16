import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock environment variables before importing anything
process.env.GROK_API_KEY = 'test-grok-api-key';
process.env.OPENAI_API_KEY = 'test-openai-api-key';

import { GrokClient } from './GrokClient.js';

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('GrokClient', () => {
  let grokClient: GrokClient;
  let mockOpenAI: any;

  beforeEach(async () => {
    grokClient = new GrokClient(2, 100); // 2 retries, 100ms delay for testing
    
    // Get the mocked OpenAI instance
    const OpenAI = vi.mocked(await import('openai')).default;
    mockOpenAI = new OpenAI();
  });

  describe('chat completion', () => {
    it('should make successful chat completion request', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Test response',
            tool_calls: null,
          },
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const messages = [
        { role: 'system' as const, content: 'You are a test assistant' },
        { role: 'user' as const, content: 'Hello' },
      ];

      const result = await grokClient.chatCompletion(messages);

      expect(result.content).toBe('Test response');
      expect(result.usage.totalTokens).toBe(15);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'grok-4',
        messages,
        temperature: 0.3,
        max_tokens: 4000,
        tools: undefined,
        search_parameters: undefined,
      });
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'I will search for products',
            tool_calls: [{
              type: 'function',
              function: {
                name: 'search_products',
                arguments: '{"query": "phone case"}',
              },
            }],
          },
        }],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await grokClient.chatCompletion([]);

      expect(result.content).toBe('I will search for products');
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0].name).toBe('search_products');
      expect(result.toolCalls?.[0].parameters).toEqual({ query: 'phone case' });
    });

    it('should handle search parameters and citations', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Based on my search...',
          },
        }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 8,
          total_tokens: 23,
          num_sources_used: 3,
        },
        citations: ['https://example.com/1', 'https://example.com/2'],
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await grokClient.chatCompletion([], {
        searchParameters: {
          mode: 'auto',
          returnCitations: true,
          maxSearchResults: 10,
        },
      });

      expect(result.citations).toEqual(['https://example.com/1', 'https://example.com/2']);
      expect(result.usage.numSourcesUsed).toBe(3);
    });

    it('should handle reasoning content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'Final answer',
            reasoning_content: 'Step by step thinking...',
          },
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
          reasoning_tokens: 50,
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await grokClient.chatCompletion([]);

      expect(result.content).toBe('Final answer');
      expect(result.reasoningContent).toBe('Step by step thinking...');
      expect(result.usage.reasoningTokens).toBe(50);
    });
  });

  describe('error handling and retries', () => {
    it('should retry on transient errors', async () => {
      const error = new Error('Network error');
      const mockResponse = {
        choices: [{
          message: { content: 'Success after retry' },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockOpenAI.chat.completions.create
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockResponse);

      const result = await grokClient.chatCompletion([]);

      expect(result.content).toBe('Success after retry');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const error = { status: 401, message: 'Unauthorized' };

      mockOpenAI.chat.completions.create.mockRejectedValueOnce(error);

      await expect(grokClient.chatCompletion([])).rejects.toEqual(error);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exceeded', async () => {
      const error = new Error('Persistent error');

      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      await expect(grokClient.chatCompletion([])).rejects.toThrow('Persistent error');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should handle missing response choice', async () => {
      const mockResponse = {
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      await expect(grokClient.chatCompletion([])).rejects.toThrow('No response choice received from Grok');
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      const mockResponse = {
        choices: [{
          message: { content: 'Simple response' },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);
    });

    it('should make simple chat request', async () => {
      const response = await grokClient.simpleChat(
        'You are a helpful assistant',
        'What is 2+2?',
        { temperature: 0.5, maxTokens: 100 }
      );

      expect(response).toBe('Simple response');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'grok-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'What is 2+2?' },
        ],
        temperature: 0.5,
        max_tokens: 100,
        tools: undefined,
        search_parameters: undefined,
      });
    });

    it('should make chat with search request', async () => {
      const mockSearchResponse = {
        choices: [{
          message: { content: 'Search result' },
        }],
        usage: { 
          prompt_tokens: 15, 
          completion_tokens: 8, 
          total_tokens: 23,
          num_sources_used: 2,
        },
        citations: ['https://example.com'],
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockSearchResponse);

      const result = await grokClient.chatWithSearch(
        [{ role: 'user', content: 'Search for dropshipping trends' }],
        { mode: 'on', maxResults: 5, returnCitations: true }
      );

      expect(result.content).toBe('Search result');
      expect(result.citations).toEqual(['https://example.com']);
      expect(result.usage.numSourcesUsed).toBe(2);
    });
  });

  describe('connection validation', () => {
    it('should validate successful connection', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'OK' },
        }],
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const isValid = await grokClient.validateConnection();

      expect(isValid).toBe(true);
    });

    it('should handle connection validation failure', async () => {
      const error = new Error('Connection failed');
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(error);

      const isValid = await grokClient.validateConnection();

      expect(isValid).toBe(false);
    });
  });

  describe('usage statistics', () => {
    it('should return null for usage stats (placeholder)', async () => {
      const stats = await grokClient.getUsageStats();
      expect(stats).toBeNull();
    });
  });
});