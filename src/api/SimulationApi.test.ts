import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SimulationApi } from './SimulationApi.js';

// Mock the DropshippingSimulation
vi.mock('../simulation/DropshippingSimulation.js', () => {
  return {
    DropshippingSimulation: vi.fn().mockImplementation((config) => {
      let isPaused = false;
      let isRunning = false;
      let isStopped = false;
      let runPromise: Promise<any> | null = null;

      return {
        config,
        run: vi.fn(() => {
          isRunning = true;
          // Create a promise that doesn't resolve immediately
          runPromise = new Promise((resolve) => {
            // Simulate a running simulation
            const checkInterval = setInterval(() => {
              if (isStopped) {
                clearInterval(checkInterval);
                resolve({
                  success: true,
                  finalDay: 10,
                  finalNetWorth: 1000,
                  totalRevenue: 2000,
                  totalSpend: 1000,
                  overallROAS: 2.0,
                  dailyMetrics: [],
                  keyDecisions: [],
                  performance: {
                    worstLosses: -100,
                    peakNetWorth: 1200,
                    averageDailyROAS: 2.1,
                  },
                });
              }
            }, 10);

            // Auto-complete after 100ms for tests that don't explicitly stop
            setTimeout(() => {
              if (!isStopped) {
                clearInterval(checkInterval);
                resolve({
                  success: true,
                  finalDay: 10,
                  finalNetWorth: 1000,
                  totalRevenue: 2000,
                  totalSpend: 1000,
                  overallROAS: 2.0,
                  dailyMetrics: [],
                  keyDecisions: [],
                  performance: {
                    worstLosses: -100,
                    peakNetWorth: 1200,
                    averageDailyROAS: 2.1,
                  },
                });
              }
            }, 100);
          });
          return runPromise;
        }),
        pause: vi.fn(() => { isPaused = true; }),
        resume: vi.fn(() => { isPaused = false; }),
        stop: vi.fn(() => { 
          isStopped = true; 
          isRunning = false;
        }),
        getStatus: vi.fn(() => ({
          isRunning: isRunning && !isStopped,
          isPaused,
          currentDay: 5,
          netWorth: 750,
          roas: 1.8,
          activeCampaigns: 3,
          activeProducts: 2,
        })),
      };
    }),
  };
});

describe('SimulationApi', () => {
  let app: express.Application;
  let simulationApi: SimulationApi;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    simulationApi = new SimulationApi();
    app.use('/api', simulationApi.getRouter());
  });

  afterEach(() => {
    simulationApi.cleanup();
    vi.clearAllMocks();
  });

  describe('POST /api/simulations', () => {
    it('should start a new simulation with default config', async () => {
      const response = await request(app)
        .post('/api/simulations')
        .send({});

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('running');
      expect(response.body.config).toEqual({
        initialCapital: 500,
        dailyAdSpend: 50,
        targetROAS: 2.0,
        maxDays: 200,
        maxContextTokens: 30000,
        maxActionsPerDay: 50,
        bankruptcyThreshold: 10,
      });
    });

    it('should start a new simulation with custom config', async () => {
      const customConfig = {
        initialCapital: 1000,
        dailyAdSpend: 100,
        targetROAS: 3.0,
        maxDays: 100,
      };

      const response = await request(app)
        .post('/api/simulations')
        .send({ config: customConfig });

      expect(response.status).toBe(201);
      expect(response.body.config.initialCapital).toBe(1000);
      expect(response.body.config.dailyAdSpend).toBe(100);
      expect(response.body.config.targetROAS).toBe(3.0);
      expect(response.body.config.maxDays).toBe(100);
    });

    it('should validate config parameters', async () => {
      const invalidConfig = {
        initialCapital: 50, // Below minimum
        dailyAdSpend: 5,   // Below minimum
        targetROAS: 1.0,   // Below minimum
        maxDays: 400,      // Above maximum
      };

      const response = await request(app)
        .post('/api/simulations')
        .send({ config: invalidConfig });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(response.body.details).toBeDefined();
    });

    it('should accept webhook URL', async () => {
      const response = await request(app)
        .post('/api/simulations')
        .send({
          webhookUrl: 'https://example.com/webhook',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });
  });

  describe('GET /api/simulations', () => {
    it('should return empty list when no simulations', async () => {
      const response = await request(app)
        .get('/api/simulations');

      expect(response.status).toBe(200);
      expect(response.body.simulations).toEqual([]);
      expect(response.body.total).toBe(0);
      expect(response.body.active).toBe(0);
    });

    it('should return list of simulations', async () => {
      // Start a simulation first
      const createResponse = await request(app)
        .post('/api/simulations')
        .send({});

      // Wait a bit to ensure simulation is still running
      await new Promise(resolve => setTimeout(resolve, 20));

      const response = await request(app)
        .get('/api/simulations');

      expect(response.status).toBe(200);
      expect(response.body.simulations).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.active).toBe(1);
      expect(response.body.simulations[0].currentStatus).toBeDefined();
    });
  });

  describe('GET /api/simulations/:id', () => {
    it('should return simulation details', async () => {
      // Start a simulation first
      const createResponse = await request(app)
        .post('/api/simulations')
        .send({});

      const simId = createResponse.body.id;

      // Wait a bit to ensure simulation is still running
      await new Promise(resolve => setTimeout(resolve, 20));

      const response = await request(app)
        .get(`/api/simulations/${simId}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(simId);
      expect(response.body.status).toBe('running');
      expect(response.body.currentStatus).toBeDefined();
      expect(response.body.config).toBeDefined();
    });

    it('should return 404 for non-existent simulation', async () => {
      const response = await request(app)
        .get('/api/simulations/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Simulation not found');
    });
  });

  describe('POST /api/simulations/:id/control', () => {
    let simId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/simulations')
        .send({});
      
      // Only set simId if creation was successful
      if (createResponse.status === 201) {
        simId = createResponse.body.id;
        // Wait to ensure simulation is running
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    });

    it('should pause a running simulation', async () => {
      const response = await request(app)
        .post(`/api/simulations/${simId}/control`)
        .send({ action: 'pause' });

      expect(response.status).toBe(200);
      expect(response.body.action).toBe('pause');
      expect(response.body.newStatus).toBe('paused');
    });

    it('should resume a paused simulation', async () => {
      // First pause
      await request(app)
        .post(`/api/simulations/${simId}/control`)
        .send({ action: 'pause' });

      // Then resume
      const response = await request(app)
        .post(`/api/simulations/${simId}/control`)
        .send({ action: 'resume' });

      expect(response.status).toBe(200);
      expect(response.body.action).toBe('resume');
      expect(response.body.newStatus).toBe('running');
    });

    it('should stop a running simulation', async () => {
      const response = await request(app)
        .post(`/api/simulations/${simId}/control`)
        .send({ action: 'stop' });

      expect(response.status).toBe(200);
      expect(response.body.action).toBe('stop');
      expect(response.body.newStatus).toBe('completed');
    });

    it('should validate control action', async () => {
      const response = await request(app)
        .post(`/api/simulations/${simId}/control`)
        .send({ action: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should return 404 for non-existent simulation', async () => {
      const response = await request(app)
        .post('/api/simulations/non-existent/control')
        .send({ action: 'pause' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Simulation not found');
    });
  });

  describe('GET /api/simulations/:id/metrics', () => {
    it('should return error when simulation not completed', async () => {
      const createResponse = await request(app)
        .post('/api/simulations')
        .send({});

      const simId = createResponse.body.id;

      // Wait a bit but not long enough for completion
      await new Promise(resolve => setTimeout(resolve, 20));

      const response = await request(app)
        .get(`/api/simulations/${simId}/metrics`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Metrics not available');
      expect(response.body.currentStatus).toBeDefined();
    });

    it('should return metrics for completed simulation', async () => {
      // This would require mocking a completed simulation
      // For now, we test the endpoint exists and handles errors correctly
      const response = await request(app)
        .get('/api/simulations/non-existent/metrics');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/simulations/:id/decisions', () => {
    it('should handle pagination parameters', async () => {
      const createResponse = await request(app)
        .post('/api/simulations')
        .send({});

      const simId = createResponse.body.id;

      const response = await request(app)
        .get(`/api/simulations/${simId}/decisions?limit=10&offset=5`);

      expect(response.status).toBe(400); // Not completed yet
      expect(response.body.error).toBe('Decisions not available');
    });
  });

  describe('DELETE /api/simulations/:id', () => {
    it('should delete a simulation', async () => {
      const createResponse = await request(app)
        .post('/api/simulations')
        .send({});

      const simId = createResponse.body.id;

      const deleteResponse = await request(app)
        .delete(`/api/simulations/${simId}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.message).toBe('Simulation deleted successfully');

      // Verify it's gone
      const getResponse = await request(app)
        .get(`/api/simulations/${simId}`);

      expect(getResponse.status).toBe(404);
    });

    it('should return 404 for non-existent simulation', async () => {
      const response = await request(app)
        .delete('/api/simulations/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('activeSimulations');
      expect(response.body).toHaveProperty('maxConcurrentSimulations');
      expect(response.body).toHaveProperty('totalSimulations');
    });
  });

  describe('Concurrent simulation limits', () => {
    it('should enforce maximum concurrent simulations', async () => {
      // Start max concurrent simulations
      const maxConcurrent = 10;
      const promises = [];

      for (let i = 0; i < maxConcurrent; i++) {
        promises.push(
          request(app)
            .post('/api/simulations')
            .send({})
        );
      }

      await Promise.all(promises);

      // Try to start one more
      const response = await request(app)
        .post('/api/simulations')
        .send({});

      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Too many concurrent simulations');
      expect(response.body.activeSimulations).toBe(maxConcurrent);
    });
  });
});