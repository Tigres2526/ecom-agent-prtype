import express, { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DropshippingSimulation } from '../simulation/DropshippingSimulation.js';
import type { AgentConfig, SimulationResult } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

// Schema validation for API requests
const StartSimulationSchema = z.object({
  config: z.object({
    initialCapital: z.number().min(100).default(500),
    dailyAdSpend: z.number().min(10).default(50),
    targetROAS: z.number().min(1.5).default(2.0),
    maxDays: z.number().min(1).max(365).default(200),
    maxContextTokens: z.number().min(1000).default(30000),
    maxActionsPerDay: z.number().min(1).max(100).default(50),
    bankruptcyThreshold: z.number().min(1).max(30).default(10),
  }).partial().optional(),
  webhookUrl: z.string().url().optional(),
});

const SimulationControlSchema = z.object({
  action: z.enum(['pause', 'resume', 'stop']),
});

interface SimulationInstance {
  id: string;
  simulation: DropshippingSimulation;
  status: 'running' | 'paused' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  result?: SimulationResult;
  error?: string;
  config: AgentConfig;
  webhookUrl?: string;
}

export class SimulationApi {
  private router: Router;
  private simulations: Map<string, SimulationInstance> = new Map();
  private maxConcurrentSimulations: number = 10;

  constructor() {
    this.router = express.Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Start a new simulation
    this.router.post('/simulations', async (req: Request, res: Response) => {
      try {
        const body = StartSimulationSchema.parse(req.body);
        
        // Check concurrent simulation limit
        const activeSimulations = Array.from(this.simulations.values())
          .filter(s => s.status === 'running' || s.status === 'paused').length;
        
        if (activeSimulations >= this.maxConcurrentSimulations) {
          return res.status(429).json({
            error: 'Too many concurrent simulations',
            message: `Maximum of ${this.maxConcurrentSimulations} simulations allowed`,
            activeSimulations,
          });
        }

        // Create new simulation
        const id = uuidv4();
        const config: AgentConfig = {
          initialCapital: body.config?.initialCapital || 500,
          dailyAdSpend: body.config?.dailyAdSpend || 50,
          targetROAS: body.config?.targetROAS || 2.0,
          maxDays: body.config?.maxDays || 200,
          maxContextTokens: body.config?.maxContextTokens || 30000,
          maxActionsPerDay: body.config?.maxActionsPerDay || 50,
          bankruptcyThreshold: body.config?.bankruptcyThreshold || 10,
        };

        const simulation = new DropshippingSimulation(config);
        const instance: SimulationInstance = {
          id,
          simulation,
          status: 'running',
          startTime: new Date(),
          config,
          webhookUrl: body.webhookUrl,
        };

        this.simulations.set(id, instance);

        // Start simulation asynchronously
        this.runSimulation(id).catch(error => {
          console.error(`Simulation ${id} failed:`, error);
        });

        res.status(201).json({
          id,
          status: 'running',
          startTime: instance.startTime,
          config,
          message: 'Simulation started successfully',
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Invalid request',
            details: error.errors,
          });
        }
        
        console.error('Failed to start simulation:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to start simulation',
        });
      }
    });

    // Get all simulations
    this.router.get('/simulations', (req: Request, res: Response) => {
      const simulations = Array.from(this.simulations.values()).map(instance => ({
        id: instance.id,
        status: instance.status,
        startTime: instance.startTime,
        endTime: instance.endTime,
        config: instance.config,
        currentStatus: instance.status === 'running' || instance.status === 'paused' 
          ? instance.simulation.getStatus()
          : undefined,
      }));

      res.json({
        simulations,
        total: simulations.length,
        active: simulations.filter(s => s.status === 'running' || s.status === 'paused').length,
      });
    });

    // Get specific simulation status
    this.router.get('/simulations/:id', (req: Request, res: Response) => {
      const { id } = req.params;
      const instance = this.simulations.get(id);

      if (!instance) {
        return res.status(404).json({
          error: 'Simulation not found',
          id,
        });
      }

      const response: any = {
        id: instance.id,
        status: instance.status,
        startTime: instance.startTime,
        endTime: instance.endTime,
        config: instance.config,
      };

      if (instance.status === 'running' || instance.status === 'paused') {
        response.currentStatus = instance.simulation.getStatus();
      }

      if (instance.result) {
        response.result = instance.result;
      }

      if (instance.error) {
        response.error = instance.error;
      }

      res.json(response);
    });

    // Control simulation (pause/resume/stop)
    this.router.post('/simulations/:id/control', (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const body = SimulationControlSchema.parse(req.body);
        
        const instance = this.simulations.get(id);
        if (!instance) {
          return res.status(404).json({
            error: 'Simulation not found',
            id,
          });
        }

        if (instance.status === 'completed' || instance.status === 'error') {
          return res.status(400).json({
            error: 'Cannot control completed simulation',
            status: instance.status,
          });
        }

        switch (body.action) {
          case 'pause':
            instance.simulation.pause();
            instance.status = 'paused';
            break;
          case 'resume':
            instance.simulation.resume();
            instance.status = 'running';
            break;
          case 'stop':
            instance.simulation.stop();
            instance.status = 'completed';
            instance.endTime = new Date();
            break;
        }

        res.json({
          id,
          action: body.action,
          newStatus: instance.status,
          message: `Simulation ${body.action}ed successfully`,
        });

      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: 'Invalid request',
            details: error.errors,
          });
        }
        
        res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to control simulation',
        });
      }
    });

    // Get simulation metrics
    this.router.get('/simulations/:id/metrics', (req: Request, res: Response) => {
      const { id } = req.params;
      const instance = this.simulations.get(id);

      if (!instance) {
        return res.status(404).json({
          error: 'Simulation not found',
          id,
        });
      }

      if (!instance.result) {
        return res.status(400).json({
          error: 'Metrics not available',
          message: 'Simulation has not completed yet',
          currentStatus: instance.status === 'running' || instance.status === 'paused' 
            ? instance.simulation.getStatus()
            : undefined,
        });
      }

      res.json({
        id,
        metrics: {
          finalDay: instance.result.finalDay,
          finalNetWorth: instance.result.finalNetWorth,
          totalRevenue: instance.result.totalRevenue,
          totalSpend: instance.result.totalSpend,
          overallROAS: instance.result.overallROAS,
          success: instance.result.success,
          bankruptcyReason: instance.result.bankruptcyReason,
          performance: instance.result.performance,
          dailyMetrics: instance.result.dailyMetrics,
        },
      });
    });

    // Get simulation decisions
    this.router.get('/simulations/:id/decisions', (req: Request, res: Response) => {
      const { id } = req.params;
      const instance = this.simulations.get(id);

      if (!instance) {
        return res.status(404).json({
          error: 'Simulation not found',
          id,
        });
      }

      if (!instance.result) {
        return res.status(400).json({
          error: 'Decisions not available',
          message: 'Simulation has not completed yet',
        });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const decisions = instance.result.keyDecisions.slice(offset, offset + limit);

      res.json({
        id,
        decisions,
        total: instance.result.keyDecisions.length,
        limit,
        offset,
      });
    });

    // Delete simulation
    this.router.delete('/simulations/:id', (req: Request, res: Response) => {
      const { id } = req.params;
      const instance = this.simulations.get(id);

      if (!instance) {
        return res.status(404).json({
          error: 'Simulation not found',
          id,
        });
      }

      // Stop if running
      if (instance.status === 'running' || instance.status === 'paused') {
        instance.simulation.stop();
      }

      this.simulations.delete(id);

      res.json({
        id,
        message: 'Simulation deleted successfully',
      });
    });

    // Health check
    this.router.get('/health', (req: Request, res: Response) => {
      const activeSimulations = Array.from(this.simulations.values())
        .filter(s => s.status === 'running' || s.status === 'paused').length;

      res.json({
        status: 'healthy',
        activeSimulations,
        maxConcurrentSimulations: this.maxConcurrentSimulations,
        totalSimulations: this.simulations.size,
      });
    });
  }

  private async runSimulation(id: string): Promise<void> {
    const instance = this.simulations.get(id);
    if (!instance) return;

    try {
      console.log(`Starting simulation ${id}`);
      const result = await instance.simulation.run();
      
      instance.status = 'completed';
      instance.endTime = new Date();
      instance.result = result;

      console.log(`Simulation ${id} completed successfully`);

      // Send webhook if configured
      if (instance.webhookUrl) {
        await this.sendWebhook(instance.webhookUrl, {
          simulationId: id,
          status: 'completed',
          result,
        });
      }

    } catch (error) {
      console.error(`Simulation ${id} failed:`, error);
      
      instance.status = 'error';
      instance.endTime = new Date();
      instance.error = error instanceof Error ? error.message : 'Unknown error';

      // Send webhook if configured
      if (instance.webhookUrl) {
        await this.sendWebhook(instance.webhookUrl, {
          simulationId: id,
          status: 'error',
          error: instance.error,
        });
      }
    }
  }

  private async sendWebhook(url: string, data: any): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        console.error(`Webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send webhook:', error);
    }
  }

  public getRouter(): Router {
    return this.router;
  }

  public cleanup(): void {
    // Stop all running simulations
    for (const [id, instance] of this.simulations) {
      if (instance.status === 'running' || instance.status === 'paused') {
        console.log(`Stopping simulation ${id} for cleanup`);
        instance.simulation.stop();
      }
    }
    this.simulations.clear();
  }
}