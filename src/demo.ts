/**
 * Demo script showing different simulation scenarios
 */
import { DropshippingSimulation } from './simulation/DropshippingSimulation.js';
import type { AgentConfig } from './types/index.js';

async function runDemo() {
  console.log('🎮 Dropshipping AI Agent Demo\n');

  // Check for required environment variables
  if (!process.env.GROK_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error('❌ Required environment variables missing!');
    console.log('Please set:');
    console.log('  export GROK_API_KEY=your-grok-api-key');
    console.log('  export OPENAI_API_KEY=your-openai-api-key');
    process.exit(1);
  }

  // Scenario 1: Conservative Strategy
  console.log('📊 Scenario 1: Conservative Strategy');
  console.log('Low capital, low daily spend, modest ROAS target\n');
  
  const conservativeConfig: AgentConfig = {
    initialCapital: 300,
    dailyAdSpend: 30,
    targetROAS: 1.5,
    maxDays: 7, // Short demo
    maxContextTokens: 30000,
    maxActionsPerDay: 20,
    bankruptcyThreshold: 5
  };

  const conservativeSim = new DropshippingSimulation(conservativeConfig);
  const conservativeResult = await conservativeSim.run();
  
  console.log('\n✅ Conservative Strategy Results:');
  console.log(`  Final Net Worth: $${conservativeResult.finalNetWorth.toFixed(2)}`);
  console.log(`  Overall ROAS: ${conservativeResult.overallROAS.toFixed(2)}x`);
  console.log(`  Success: ${conservativeResult.success ? 'Yes' : 'No'}\n`);

  // Wait a bit between simulations
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 2: Aggressive Strategy
  console.log('\n📊 Scenario 2: Aggressive Strategy');
  console.log('Higher capital, higher daily spend, aggressive ROAS target\n');
  
  const aggressiveConfig: AgentConfig = {
    initialCapital: 1000,
    dailyAdSpend: 100,
    targetROAS: 3.0,
    maxDays: 7, // Short demo
    maxContextTokens: 30000,
    maxActionsPerDay: 50,
    bankruptcyThreshold: 10
  };

  const aggressiveSim = new DropshippingSimulation(aggressiveConfig);
  const aggressiveResult = await aggressiveSim.run();
  
  console.log('\n✅ Aggressive Strategy Results:');
  console.log(`  Final Net Worth: $${aggressiveResult.finalNetWorth.toFixed(2)}`);
  console.log(`  Overall ROAS: ${aggressiveResult.overallROAS.toFixed(2)}x`);
  console.log(`  Success: ${aggressiveResult.success ? 'Yes' : 'No'}\n`);

  // Wait a bit between simulations
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scenario 3: Balanced Strategy
  console.log('\n📊 Scenario 3: Balanced Strategy');
  console.log('Moderate capital, balanced spend, realistic ROAS target\n');
  
  const balancedConfig: AgentConfig = {
    initialCapital: 500,
    dailyAdSpend: 50,
    targetROAS: 2.0,
    maxDays: 7, // Short demo
    maxContextTokens: 30000,
    maxActionsPerDay: 30,
    bankruptcyThreshold: 7
  };

  const balancedSim = new DropshippingSimulation(balancedConfig);
  const balancedResult = await balancedSim.run();
  
  console.log('\n✅ Balanced Strategy Results:');
  console.log(`  Final Net Worth: $${balancedResult.finalNetWorth.toFixed(2)}`);
  console.log(`  Overall ROAS: ${balancedResult.overallROAS.toFixed(2)}x`);
  console.log(`  Success: ${balancedResult.success ? 'Yes' : 'No'}\n`);

  // Compare all strategies
  console.log('\n📈 Strategy Comparison:');
  console.log('================================');
  console.log('Strategy      | Final NW  | ROAS  | Success');
  console.log('--------------|-----------|-------|--------');
  console.log(`Conservative  | $${conservativeResult.finalNetWorth.toFixed(2).padEnd(8)} | ${conservativeResult.overallROAS.toFixed(2)}x  | ${conservativeResult.success ? '✅' : '❌'}`);
  console.log(`Aggressive    | $${aggressiveResult.finalNetWorth.toFixed(2).padEnd(8)} | ${aggressiveResult.overallROAS.toFixed(2)}x  | ${aggressiveResult.success ? '✅' : '❌'}`);
  console.log(`Balanced      | $${balancedResult.finalNetWorth.toFixed(2).padEnd(8)} | ${balancedResult.overallROAS.toFixed(2)}x  | ${balancedResult.success ? '✅' : '❌'}`);

  // Find best strategy
  const strategies = [
    { name: 'Conservative', result: conservativeResult, config: conservativeConfig },
    { name: 'Aggressive', result: aggressiveResult, config: aggressiveConfig },
    { name: 'Balanced', result: balancedResult, config: balancedConfig }
  ];

  const bestStrategy = strategies.reduce((best, current) => 
    current.result.finalNetWorth > best.result.finalNetWorth ? current : best
  );

  console.log(`\n🏆 Best Strategy: ${bestStrategy.name}`);
  console.log(`   ROI: ${((bestStrategy.result.finalNetWorth - bestStrategy.config.initialCapital) / bestStrategy.config.initialCapital * 100).toFixed(1)}%`);

  // Save comparison results
  const fs = await import('fs/promises');
  const comparisonData = {
    timestamp: new Date().toISOString(),
    scenarios: strategies.map(s => ({
      name: s.name,
      config: s.config,
      results: {
        finalNetWorth: s.result.finalNetWorth,
        overallROAS: s.result.overallROAS,
        success: s.result.success,
        finalDay: s.result.finalDay,
        totalRevenue: s.result.totalRevenue,
        totalSpend: s.result.totalSpend
      }
    })),
    bestStrategy: bestStrategy.name
  };

  const resultsPath = `demo_comparison_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  await fs.writeFile(resultsPath, JSON.stringify(comparisonData, null, 2));
  console.log(`\n💾 Comparison results saved to: ${resultsPath}`);
}

// Run the demo
console.log('Starting demo simulations...\n');
runDemo().catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
});