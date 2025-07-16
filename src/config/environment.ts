import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Environment variable schema
const envSchema = z.object({
  // AI API Keys
  GROK_API_KEY: z.string().min(1, 'GROK_API_KEY is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  
  // Social Media API Keys (optional for development)
  FACEBOOK_API_KEY: z.string().optional(),
  TIKTOK_API_KEY: z.string().optional(),
  GOOGLE_ADS_API_KEY: z.string().optional(),
  
  // Ecommerce Platform Keys (optional for development)
  SHOPIFY_API_KEY: z.string().optional(),
  ALIEXPRESS_API_KEY: z.string().optional(),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  
  // Agent Configuration
  DEFAULT_INITIAL_CAPITAL: z.string().transform(Number).default('500'),
  DEFAULT_DAILY_AD_SPEND: z.string().transform(Number).default('50'),
  DEFAULT_TARGET_ROAS: z.string().transform(Number).default('2.0'),
  DEFAULT_MAX_DAYS: z.string().transform(Number).default('200'),
  
  // API Configuration
  GROK_BASE_URL: z.string().default('https://api.x.ai/v1'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  
  // Rate Limiting
  MAX_REQUESTS_PER_MINUTE: z.string().transform(Number).default('240'),
  MAX_TOKENS_PER_MINUTE: z.string().transform(Number).default('200000'),
});

// Validate and export environment variables
export const env = envSchema.parse(process.env);

// Agent default configuration
export const defaultAgentConfig = {
  initialCapital: env.DEFAULT_INITIAL_CAPITAL,
  dailyAdSpend: env.DEFAULT_DAILY_AD_SPEND,
  targetROAS: env.DEFAULT_TARGET_ROAS,
  maxDays: env.DEFAULT_MAX_DAYS,
  maxContextTokens: 30000,
  maxActionsPerDay: 50,
  bankruptcyThreshold: 10, // days
};

// API configuration
export const apiConfig = {
  grok: {
    apiKey: env.GROK_API_KEY,
    baseURL: env.GROK_BASE_URL,
    model: 'grok-4',
    maxTokens: 4000,
    temperature: 0.3,
  },
  openai: {
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
    embeddingModel: 'text-embedding-3-small',
    maxEmbeddingTokens: 8192,
  },
  rateLimits: {
    maxRequestsPerMinute: env.MAX_REQUESTS_PER_MINUTE,
    maxTokensPerMinute: env.MAX_TOKENS_PER_MINUTE,
  },
};

// Validation helper
export function validateEnvironment(): void {
  try {
    envSchema.parse(process.env);
    console.log('✅ Environment configuration validated successfully');
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    process.exit(1);
  }
}

// Development mode helpers
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';