import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { SimulationApi } from './SimulationApi.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// API routes
const simulationApi = new SimulationApi();
app.use('/api', simulationApi.getRouter());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Dropshipping AI Agent Simulation API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      simulations: {
        list: 'GET /api/simulations',
        create: 'POST /api/simulations',
        get: 'GET /api/simulations/:id',
        control: 'POST /api/simulations/:id/control',
        metrics: 'GET /api/simulations/:id/metrics',
        decisions: 'GET /api/simulations/:id/decisions',
        delete: 'DELETE /api/simulations/:id',
      },
    },
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Start server
const server = app.listen(port, () => {
  console.log(`🚀 Simulation API server running on port ${port}`);
  console.log(`📍 http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Stop accepting new connections
  server.close(() => {
    console.log('Server closed');
    
    // Cleanup simulations
    simulationApi.cleanup();
    
    process.exit(0);
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  server.close(() => {
    console.log('Server closed');
    simulationApi.cleanup();
    process.exit(0);
  });
});

export default app;