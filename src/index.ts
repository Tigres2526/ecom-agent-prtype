// Main entry point for the Dropshipping AI Agent
import { validateEnvironment } from './config/environment.js';

// Validate environment on startup
validateEnvironment();

// Export main components
export * from './agent/index.js';
export * from './memory/index.js';
export * from './tools/index.js';
export * from './simulation/index.js';
export * from './types/index.js';
export * from './config/environment.js';
export * from './logging/index.js';

console.log('🤖 Dropshipping AI Agent initialized successfully');