#!/usr/bin/env node
import { DropshippingSimulation } from './simulation/DropshippingSimulation.js';
import type { AgentConfig } from './types/index.js';

/**
 * Main entry point to run the dropshipping AI agent simulation
 */
async function runSimulation() {
  console.log('🚀 Dropshipping AI Agent Simulation');
  console.log('====================================\n');

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
    maxDays: 200,
    maxContextTokens: 30000,
    maxActionsPerDay: 50,
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

  // Create and run simulation
  const simulation = new DropshippingSimulation(config);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Received interrupt signal, stopping simulation...');
    simulation.stop();
  });

  process.on('SIGTERM', () => {
    console.log('\n\n⚠️  Received termination signal, stopping simulation...');
    simulation.stop();
  });

  try {
    // Run the simulation
    const result = await simulation.run();

    // Display summary results
    console.log('\n\n📊 SIMULATION SUMMARY');
    console.log('====================');
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Total Days: ${result.finalDay}`);
    console.log(`Final Net Worth: $${result.finalNetWorth.toFixed(2)}`);
    console.log(`Total Revenue: $${result.totalRevenue.toFixed(2)}`);
    console.log(`Total Spend: $${result.totalSpend.toFixed(2)}`);
    console.log(`Overall ROAS: ${result.overallROAS.toFixed(2)}x`);

    if (result.bankruptcyReason) {
      console.log(`\n💀 Bankruptcy Reason: ${result.bankruptcyReason}`);
    }

    // Performance highlights
    if (result.performance) {
      console.log('\n🏆 Performance Highlights:');
      console.log(`  Peak Net Worth: $${result.performance.peakNetWorth.toFixed(2)}`);
      console.log(`  Worst Loss: $${result.performance.worstLosses.toFixed(2)}`);
      console.log(`  Average Daily ROAS: ${result.performance.averageDailyROAS.toFixed(2)}x`);

      if (result.performance.bestProduct) {
        const product = result.performance.bestProduct;
        console.log(`  Best Product: ${product.name} (${product.margin.toFixed(1)}% margin)`);
      }

      if (result.performance.bestCampaign) {
        const campaign = result.performance.bestCampaign;
        console.log(`  Best Campaign: ${campaign.platform} - ${campaign.angle} (${campaign.roas.toFixed(2)}x ROAS)`);
      }
    }

    // Key decisions
    if (result.keyDecisions && result.keyDecisions.length > 0) {
      console.log('\n🎯 Last 5 Key Decisions:');
      result.keyDecisions.slice(-5).forEach((decision, index) => {
        console.log(`  ${index + 1}. Day ${decision.day}: ${decision.decision} (${(decision.confidence * 100).toFixed(0)}% confidence)`);
      });
    }

    // Save detailed results to file
    const fs = await import('fs/promises');
    const resultsPath = `simulation_results_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultsPath}`);

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Simulation failed with error:', error);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Dropshipping AI Agent Simulation

Usage: npm run simulate [options]

Options:
  --days <number>         Maximum number of days to simulate (default: 200)
  --capital <number>      Initial capital in dollars (default: 500)
  --daily-spend <number>  Daily ad spend limit in dollars (default: 50)
  --target-roas <number>  Target return on ad spend (default: 2.0)
  --help                  Show this help message

Examples:
  npm run simulate
  npm run simulate --days 30 --capital 1000
  npm run simulate --days 7 --capital 200 --daily-spend 25 --target-roas 2.5

Environment Variables Required:
  GROK_API_KEY      Your Grok-4 API key
  OPENAI_API_KEY    Your OpenAI API key (for embeddings)
`);
}

// Run the simulation
runSimulation().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});