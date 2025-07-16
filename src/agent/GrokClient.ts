import OpenAI from 'openai';
import type { ToolCall, ToolResult } from '../types/index.js';
import { apiConfig } from '../config/environment.js';

/**
 * Grok-4 client wrapper with error handling and retries
 */
export class GrokClient {
  private client: OpenAI;
  private maxRetries: number;
  private retryDelay: number;

  constructor(maxRetries: number = 3, retryDelay: number = 1000) {
    this.client = new OpenAI({
      apiKey: apiConfig.grok.apiKey,
      baseURL: apiConfig.grok.baseURL,
    });
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }

  /**
   * Makes a chat completion request with retry logic
   */
  public async chatCompletion(
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
      tool_calls?: ToolCall[];
    }>,
    options: {
      tools?: Array<{
        type: 'function';
        function: {
          name: string;
          description: string;
          parameters: Record<string, any>;
        };
      }>;
      temperature?: number;
      maxTokens?: number;
      searchParameters?: {
        mode?: 'auto' | 'on' | 'off';
        returnCitations?: boolean;
        maxSearchResults?: number;
        sources?: Array<{ type: string; [key: string]: any }>;
      };
    } = {}
  ): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    reasoningContent?: string;
    citations?: string[];
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      reasoningTokens?: number;
      numSourcesUsed?: number;
    };
  }> {
    // Convert messages to OpenAI format
    const openAIMessages = messages.map(msg => {
      if (msg.role === 'tool') {
        // Convert tool role to assistant role for OpenAI compatibility
        return {
          role: 'assistant' as const,
          content: msg.content,
          tool_calls: msg.tool_calls
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      };
    });

    const requestOptions: any = {
      model: apiConfig.grok.model,
      messages: openAIMessages,
      temperature: options.temperature ?? apiConfig.grok.temperature,
      max_tokens: options.maxTokens ?? apiConfig.grok.maxTokens,
      tools: options.tools,
      search_parameters: options.searchParameters,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create(requestOptions);
        
        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response choice received from Grok');
        }

        const message = choice.message;
        const usage = response.usage;

        // Extract tool calls if present
        const toolCalls: ToolCall[] = [];
        if (message.tool_calls) {
          for (const toolCall of message.tool_calls) {
            if (toolCall.type === 'function') {
              toolCalls.push({
                name: toolCall.function.name,
                parameters: JSON.parse(toolCall.function.arguments || '{}'),
              });
            }
          }
        }

        return {
          content: message.content || '',
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          reasoningContent: (message as any).reasoning_content,
          citations: (response as any).citations,
          usage: {
            promptTokens: usage?.prompt_tokens || 0,
            completionTokens: usage?.completion_tokens || 0,
            totalTokens: usage?.total_tokens || 0,
            reasoningTokens: (usage as any)?.reasoning_tokens,
            numSourcesUsed: (usage as any)?.num_sources_used,
          },
        };
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        // If this is the last attempt, throw the error
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        // Wait before retrying with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
        
        console.warn(`Grok API attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Makes a simple chat request without tools
   */
  public async simpleChat(
    systemPrompt: string,
    userMessage: string,
    options: {
      temperature?: number;
      maxTokens?: number;
      useSearch?: boolean;
    } = {}
  ): Promise<string> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ];

    const searchParameters = options.useSearch ? { mode: 'auto' as const } : undefined;

    const response = await this.chatCompletion(messages, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      searchParameters,
    });

    return response.content;
  }

  /**
   * Makes a chat request with live search enabled
   */
  public async chatWithSearch(
    messages: Array<{
      role: 'system' | 'user' | 'assistant' | 'tool';
      content: string;
    }>,
    searchOptions: {
      mode?: 'auto' | 'on' | 'off';
      maxResults?: number;
      sources?: Array<{ type: string; [key: string]: any }>;
      returnCitations?: boolean;
    } = {}
  ): Promise<{
    content: string;
    citations?: string[];
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      numSourcesUsed?: number;
    };
  }> {
    const response = await this.chatCompletion(messages, {
      searchParameters: {
        mode: searchOptions.mode || 'auto',
        maxSearchResults: searchOptions.maxResults || 20,
        sources: searchOptions.sources,
        returnCitations: searchOptions.returnCitations ?? true,
      },
    });

    return {
      content: response.content,
      citations: response.citations,
      usage: response.usage,
    };
  }

  /**
   * Checks if an error should not be retried
   */
  private isNonRetryableError(error: any): boolean {
    // Don't retry on authentication errors
    if (error.status === 401 || error.status === 403) {
      return true;
    }
    
    // Don't retry on bad request errors
    if (error.status === 400) {
      return true;
    }
    
    // Don't retry on quota exceeded errors
    if (error.status === 429 && error.message?.includes('quota')) {
      return true;
    }
    
    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validates API connection
   */
  public async validateConnection(): Promise<boolean> {
    try {
      await this.simpleChat(
        'You are a test assistant.',
        'Respond with "OK" if you can hear me.',
        { maxTokens: 10 }
      );
      return true;
    } catch (error) {
      console.error('Grok connection validation failed:', error);
      return false;
    }
  }

  /**
   * Gets API usage statistics (if available)
   */
  public async getUsageStats(): Promise<{
    requestsToday: number;
    tokensToday: number;
    quotaRemaining: number;
  } | null> {
    // This would need to be implemented based on Grok's API
    // Currently returning null as placeholder
    return null;
  }
}