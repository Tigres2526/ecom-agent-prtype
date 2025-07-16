# Dropshipping AI Agent API Documentation

## Overview

The Dropshipping AI Agent provides a REST API for managing and monitoring autonomous dropshipping operations. The API allows you to start simulations, monitor agent performance, and control various aspects of the AI agent's behavior.

## Base URL

```
http://localhost:3000
```

## Authentication

If `ENABLE_API_AUTH` is set to `true` in your environment, all requests must include an API key:

```http
Authorization: Bearer your-api-key-here
```

## Endpoints

### Health Check

Check if the API server is running and healthy.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Simulations

#### Start a New Simulation

Start a new dropshipping simulation with specified parameters.

```http
POST /simulations
```

**Request Body:**
```json
{
  "config": {
    "initialCapital": 1000,
    "maxDays": 30,
    "autoStart": true
  },
  "webhookUrl": "https://your-server.com/webhook"
}
```

**Response:**
```json
{
  "id": "sim_123abc",
  "status": "running",
  "startedAt": "2024-01-15T10:30:00.000Z",
  "config": {
    "initialCapital": 1000,
    "maxDays": 30,
    "autoStart": true
  }
}
```

#### Get Simulation Status

Get the current status and metrics of a running simulation.

```http
GET /simulations/:id
```

**Response:**
```json
{
  "id": "sim_123abc",
  "status": "running",
  "day": 15,
  "metrics": {
    "netWorth": 1250.50,
    "totalRevenue": 2500.00,
    "totalSpend": 1200.00,
    "totalProfit": 1300.00,
    "roas": 2.08,
    "activeCampaigns": 5,
    "successfulCampaigns": 8,
    "failedCampaigns": 3,
    "totalProducts": 12
  },
  "recentDecisions": [
    {
      "timestamp": "2024-01-15T10:25:00.000Z",
      "action": "CREATE_CAMPAIGN",
      "reasoning": "Product shows high potential based on competitor analysis",
      "confidence": 0.85
    }
  ]
}
```

#### Stop a Simulation

Stop a running simulation gracefully.

```http
POST /simulations/:id/stop
```

**Response:**
```json
{
  "id": "sim_123abc",
  "status": "stopped",
  "stoppedAt": "2024-01-15T10:35:00.000Z",
  "finalMetrics": {
    "netWorth": 1250.50,
    "totalDays": 15,
    "totalRevenue": 2500.00,
    "totalProfit": 1300.00
  }
}
```

#### Get Simulation Report

Get a comprehensive report of a completed simulation.

```http
GET /simulations/:id/report
```

**Response:**
```json
{
  "id": "sim_123abc",
  "status": "completed",
  "summary": {
    "totalDays": 30,
    "initialCapital": 1000,
    "finalNetWorth": 3500,
    "totalRevenue": 15000,
    "totalSpend": 12500,
    "totalProfit": 2500,
    "overallROAS": 1.2,
    "bankruptcyDay": null
  },
  "campaigns": {
    "total": 25,
    "successful": 18,
    "failed": 7,
    "bestCampaign": {
      "id": "camp_456",
      "product": "Wireless Earbuds",
      "platform": "facebook",
      "roas": 5.2,
      "revenue": 2500
    }
  },
  "products": {
    "researched": 50,
    "tested": 25,
    "winners": 5,
    "bestProduct": {
      "id": "prod_789",
      "name": "Smart Watch",
      "totalRevenue": 5000,
      "margin": 0.65
    }
  },
  "timeline": [
    {
      "day": 1,
      "netWorth": 995,
      "decisions": ["RESEARCH_PRODUCTS"],
      "events": ["Started product research in Electronics"]
    }
  ]
}
```

### Agent Control

#### Execute Agent Action

Manually trigger a specific agent action.

```http
POST /agent/execute
```

**Request Body:**
```json
{
  "action": "RESEARCH_PRODUCTS",
  "parameters": {
    "category": "Electronics",
    "priceRange": {
      "min": 20,
      "max": 100
    },
    "minMargin": 0.5
  }
}
```

**Response:**
```json
{
  "success": true,
  "action": "RESEARCH_PRODUCTS",
  "result": {
    "products": [
      {
        "id": "prod_123",
        "name": "Bluetooth Speaker",
        "price": 49.99,
        "cost": 18.00,
        "margin": 0.64,
        "competitorCount": 12
      }
    ]
  },
  "executionTime": 1250
}
```

#### Get Agent State

Get the current state of the AI agent.

```http
GET /agent/state
```

**Response:**
```json
{
  "netWorth": 1500,
  "cash": 500,
  "invested": 1000,
  "dailyFee": 5,
  "campaigns": {
    "active": 5,
    "total": 15
  },
  "products": {
    "active": 8,
    "total": 25
  },
  "mode": "normal",
  "errors": {
    "count": 2,
    "lastError": "API rate limit reached",
    "lastErrorTime": "2024-01-15T10:20:00.000Z"
  }
}
```

### Metrics and Monitoring

#### Get Current Metrics

Get real-time metrics from the monitoring system.

```http
GET /metrics
```

**Response (Prometheus format):**
```
# HELP business_revenue Total revenue generated
# TYPE business_revenue counter
business_revenue 15000

# HELP business_roas Current return on ad spend
# TYPE business_roas gauge
business_roas 2.1

# HELP system_uptime System uptime in seconds
# TYPE system_uptime counter
system_uptime 3600
```

#### Get Metrics Report

Get a formatted metrics report.

```http
GET /metrics/report
```

**Response:**
```json
{
  "business": {
    "revenue": 15000,
    "spend": 7000,
    "netWorth": 8000,
    "roas": 2.14,
    "activeCampaigns": 5,
    "activeProducts": 12
  },
  "system": {
    "uptime": 3600,
    "memoryUsage": 125829120,
    "errorRate": 0.02,
    "apiCalls": 1250
  },
  "performance": {
    "avgDecisionTime": 1.5,
    "avgApiLatency": 250,
    "successRate": 0.85
  }
}
```

### Logs and Audit

#### Get Recent Logs

Retrieve recent log entries.

```http
GET /logs?level=info&limit=100&category=DECISION
```

**Query Parameters:**
- `level`: Log level filter (debug, info, warn, error, critical)
- `limit`: Maximum number of entries to return (default: 100)
- `category`: Category filter (e.g., DECISION, FINANCIAL, CAMPAIGN)
- `since`: ISO timestamp to get logs after

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "level": "INFO",
      "category": "DECISION",
      "message": "Created new campaign",
      "data": {
        "campaignId": "camp_123",
        "platform": "facebook",
        "budget": 100
      }
    }
  ],
  "total": 250,
  "returned": 100
}
```

#### Get Audit Trail

Retrieve audit trail entries for compliance and analysis.

```http
GET /audit?category=financial&startDate=2024-01-01&endDate=2024-01-31
```

**Query Parameters:**
- `category`: Audit category (financial, decision, campaign, product, system)
- `startDate`: Start date for audit entries
- `endDate`: End date for audit entries
- `action`: Specific action to filter

**Response:**
```json
{
  "entries": [
    {
      "id": "audit_123",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "action": "FINANCIAL_EXPENSE",
      "category": "financial",
      "actor": "AI_AGENT",
      "details": {
        "transactionId": "txn_456",
        "type": "expense",
        "amount": 50,
        "description": "Campaign budget"
      },
      "previousState": {
        "balance": 1000
      },
      "newState": {
        "balance": 950
      },
      "hash": "a1b2c3d4..."
    }
  ],
  "total": 150,
  "integrityValid": true
}
```

## WebSocket Events

Connect to WebSocket for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event);
});
```

**Event Types:**
- `simulation.started`: Simulation has started
- `simulation.day_completed`: A simulation day has completed
- `simulation.completed`: Simulation has finished
- `decision.made`: Agent made a decision
- `campaign.created`: New campaign created
- `campaign.updated`: Campaign metrics updated
- `alert.triggered`: Monitoring alert triggered
- `error.occurred`: Error occurred

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid simulation ID",
    "details": {
      "field": "id",
      "value": "invalid-id"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Common Error Codes:**
- `INVALID_REQUEST`: Request validation failed
- `NOT_FOUND`: Resource not found
- `UNAUTHORIZED`: Authentication failed
- `RATE_LIMITED`: Rate limit exceeded
- `INTERNAL_ERROR`: Server error

## Rate Limiting

API requests are rate limited based on configuration:
- Default: 100 requests per minute
- Configurable via `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705318200
```

## Examples

### Start a Simulation with cURL

```bash
curl -X POST http://localhost:3000/simulations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "config": {
      "initialCapital": 2000,
      "maxDays": 30
    }
  }'
```

### Monitor Simulation Status

```bash
curl http://localhost:3000/simulations/sim_123abc \
  -H "Authorization: Bearer your-api-key"
```

### Execute Product Research

```bash
curl -X POST http://localhost:3000/agent/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "action": "RESEARCH_PRODUCTS",
    "parameters": {
      "category": "Home & Garden",
      "minMargin": 0.6
    }
  }'
```