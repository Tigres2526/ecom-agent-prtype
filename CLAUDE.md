# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Dropshipping AI Agent - an autonomous AI-powered system that manages entire ecommerce dropshipping businesses. It uses the Grok-4 model for decision-making and can operate autonomously for extended periods (200+ days).

## Development Commands

```bash
# Build TypeScript
npm run build

# Development (runs with tsx)
npm run dev

# Run tests
npm run test

# Watch mode testing
npm run test:watch

# Run business simulation
npm run simulate

# Production start
npm run start
```

## Architecture

The codebase follows a modular architecture with clear separation of concerns:

- **Core Agent System** (`src/agent/`): ContextManager handles memory and conversation context, DecisionEngine makes AI-powered business decisions, ErrorRecovery provides fault tolerance with circuit breakers, and FinancialTracker manages budgets and ROAS.

- **Memory System** (`src/memory/`): Implements long-term memory with vector search capabilities for semantic retrieval across 30,000+ tokens of context.

- **Business Tools** (`src/tools/`): Product research, campaign management, and marketing angle generation tools that integrate with ecommerce and advertising platforms.

- **Type Safety**: Uses Zod for runtime validation and comprehensive TypeScript interfaces in `src/types/`.

## Key Development Patterns

1. **Error Handling**: All external API calls go through ErrorRecovery with circuit breakers
2. **State Management**: AgentState tracks all business metrics and decisions
3. **Memory Context**: Use ContextManager to maintain conversation history and retrieve relevant past decisions
4. **Financial Safety**: FinancialTracker prevents bankruptcy and enforces budget constraints

## Testing

Tests use Vitest and follow the pattern `*.test.ts`. Each major component has corresponding unit tests. Run a single test file:

```bash
npx vitest src/agent/DecisionEngine.test.ts
```

## Environment Configuration

Required environment variables:
- `GROK_API_KEY`: For Grok-4 AI model
- `OPENAI_API_KEY`: For embeddings (text-embedding-3-small)

Optional platform API keys for full functionality:
- Facebook, TikTok, Google Ads API keys
- Shopify, BigCommerce credentials

See `.env.example` for all configuration options.

## Important: After Completing Tasks

**ALWAYS run these commands after implementing features:**

1. **Build Check**: Run `npm run build` to ensure TypeScript compiles without errors
2. **Test Suite**: Run `npm test` to verify all tests pass
3. **Fix any errors before marking task as complete**

Note: There is currently no lint configuration, but the TypeScript compiler will catch type errors.