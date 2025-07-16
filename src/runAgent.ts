#!/usr/bin/env node
import { DropshippingAgent } from './agent/DropshippingAgent.js';
import type { AgentConfig } from './types/index.js';

/**
 * Main entry point to run the dropshipping agent
 */
async function runAgent() {
  console.log('🤖 Dropshipping AI Agent');
  console.log('========================\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const configOverrides: Partial<AgentConfig> = {};

  // Simple argument parsing
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];

    if (key && value) {
      switch (key) {
        case 'days':
          configOverrides.maxDays = parseInt(value);
          break;
        case 'capital':
          configOverrides.initialCapital = parseFloat(value);
          break;
        case 'daily-spend':
          configOverrides.dailyAdSpend = parseFloat(value);
          break;
        case 'target-roas':
          configOverrides.targetROAS = parseFloat(value);
          break;
        case 'help':
          printHelp();
          return;
      }
    }
  }

  // Default configuration
  const config: AgentConfig = {
    initialCapital: 500,
    dailyAdSpend: 50,
    targetROAS: 2.0,
    maxDays: 30,
    maxContextTokens: 30000,
    maxActionsPerDay: 20,
    bankruptcyThreshold: 10,
    ...configOverrides
  };

  // Validate configuration
  if (config.initialCapital <= 0) {
    console.error('❌ Initial capital must be positive');
    process.exit(1);
  }

  if (config.dailyAdSpend <= 0) {
    console.error('❌ Daily ad spend must be positive');
    process.exit(1);
  }

  if (config.targetROAS <= 0) {
    console.error('❌ Target ROAS must be positive');
    process.exit(1);
  }

  if (config.maxDays <= 0) {
    console.error('❌ Max days must be positive');
    process.exit(1);
  }

  // Check for required environment variables
  if (!process.env.GROK_API_KEY) {
    console.error('❌ GROK_API_KEY environment variable is required');
    console.log('Please set it with: export GROK_API_KEY=your-api-key');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required for embeddings');
    console.log('Please set it with: export OPENAI_API_KEY=your-api-key');
    process.exit(1);
  }

  // Display configuration
  console.log('📋 Configuration:');
  console.log(`  Initial Capital: $${config.initialCapital}`);
  console.log(`  Daily Ad Spend: $${config.dailyAdSpend}`);
  console.log(`  Target ROAS: ${config.targetROAS}x`);
  console.log(`  Max Days: ${config.maxDays}`);
  console.log(`  Max Actions/Day: ${config.maxActionsPerDay}`);
  console.log(`  Bankruptcy Threshold: ${config.bankruptcyThreshold} days`);
  console.log('\n');

  // Create and run agent
  const agent = new DropshippingAgent(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Received interrupt signal, stopping agent...');
    agent.stop();
  });

  process.on('SIGTERM', () => {
    console.log('\n\n⚠️  Received termination signal, stopping agent...');
    agent.stop();
  });

  try {
    // Run the agent
    await agent.run();

    // Get final status
    const status = agent.getStatus();
    console.log('\n\n📊 AGENT FINAL STATUS');
    console.log('====================');
    console.log(JSON.stringify(status, null, 2));

    // Exit with appropriate code
    process.exit(status.financialHealth.status === 'bankrupt' ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Agent failed with error:', error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Dropshipping AI Agent

Usage: npm run agent [options]

Options:
  --days <number>         Maximum number of days to run (default: 30)
  --capital <number>      Initial capital in dollars (default: 500)
  --daily-spend <number>  Daily ad spend limit in dollars (default: 50)
  --target-roas <number>  Target return on ad spend (default: 2.0)
  --help                  Show this help message

Examples:
  npm run agent
  npm run agent --days 7 --capital 1000
  npm run agent --days 30 --capital 500 --daily-spend 25 --target-roas 2.5

Environment Variables Required:
  GROK_API_KEY      Your Grok-4 API key
  OPENAI_API_KEY    Your OpenAI API key (for embeddings)
`);
}

// Run the agent
runAgent().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});