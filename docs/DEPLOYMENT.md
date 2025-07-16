# Deployment Guide

This guide covers deploying the Dropshipping AI Agent in various environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployment](#cloud-deployment)
5. [Production Configuration](#production-configuration)
6. [Monitoring Setup](#monitoring-setup)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB for application and logs
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows with WSL2

### Software Requirements

- Node.js 20.x or later
- Docker 20.10+ and Docker Compose 2.x
- Git

### API Keys Required

- Grok-4 API key (Required)
- OpenAI API key (Required for embeddings)
- Platform-specific keys (Facebook, TikTok, Google Ads) if using real campaigns

## Local Development

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/dropshipping-ai-agent.git
cd dropshipping-ai-agent
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env  # or your preferred editor
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

### 5. Access Application

- API: http://localhost:3000
- Web UI: http://localhost:3000
- Health Check: http://localhost:3000/health

## Docker Deployment

### 1. Build Docker Image

```bash
docker build -t dropshipping-ai-agent:latest .
```

### 2. Run with Docker Compose

```bash
# Basic deployment
docker-compose up -d

# With monitoring (Prometheus + Grafana)
docker-compose --profile monitoring up -d
```

### 3. Check Container Status

```bash
docker-compose ps
docker-compose logs -f dropshipping-agent
```

### 4. Stop Services

```bash
docker-compose down
```

## Cloud Deployment

### AWS ECS Deployment

1. **Build and Push Image to ECR**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REGISTRY
docker build -t dropshipping-agent .
docker tag dropshipping-agent:latest $ECR_REGISTRY/dropshipping-agent:latest
docker push $ECR_REGISTRY/dropshipping-agent:latest
```

2. **Create Task Definition**
```json
{
  "family": "dropshipping-agent",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "dropshipping-agent",
      "image": "${ECR_REGISTRY}/dropshipping-agent:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"}
      ],
      "secrets": [
        {
          "name": "GROK_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:grok-api-key"
        },
        {
          "name": "OPENAI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:openai-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/dropshipping-agent",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

3. **Create ECS Service**
```bash
aws ecs create-service \
  --cluster production \
  --service-name dropshipping-agent \
  --task-definition dropshipping-agent:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Google Cloud Run Deployment

1. **Build and Push to GCR**
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/dropshipping-agent
```

2. **Deploy to Cloud Run**
```bash
gcloud run deploy dropshipping-agent \
  --image gcr.io/PROJECT-ID/dropshipping-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets GROK_API_KEY=grok-api-key:latest,OPENAI_API_KEY=openai-api-key:latest \
  --memory 2Gi \
  --cpu 2
```

### Kubernetes Deployment

1. **Create Namespace**
```bash
kubectl create namespace dropshipping
```

2. **Create Secrets**
```bash
kubectl create secret generic api-keys \
  --from-literal=grok-api-key=$GROK_API_KEY \
  --from-literal=openai-api-key=$OPENAI_API_KEY \
  -n dropshipping
```

3. **Apply Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dropshipping-agent
  namespace: dropshipping
spec:
  replicas: 1
  selector:
    matchLabels:
      app: dropshipping-agent
  template:
    metadata:
      labels:
        app: dropshipping-agent
    spec:
      containers:
      - name: agent
        image: dropshipping-agent:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: GROK_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: grok-api-key
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: api-keys
              key: openai-api-key
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: dropshipping-agent
  namespace: dropshipping
spec:
  selector:
    app: dropshipping-agent
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Production Configuration

### Environment Variables

```bash
# Production settings
NODE_ENV=production
LOG_LEVEL=info
ENABLE_CONSOLE_LOGS=false
ENABLE_FILE_LOGS=true

# Security
ENABLE_API_AUTH=true
API_KEY=generate-strong-api-key-here
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Performance
MAX_CONCURRENT_CAMPAIGNS=100
MEMORY_RETENTION_DAYS=30
CONTEXT_WINDOW_SIZE=30000
DECISION_TIMEOUT_MS=30000

# Error Handling
CIRCUIT_BREAKER_THRESHOLD=10
CIRCUIT_BREAKER_TIMEOUT_MS=300000
RETRY_MAX_ATTEMPTS=5
RETRY_DELAY_MS=2000
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Monitoring Setup

### Prometheus Configuration

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files:
  - "alerts.yml"

scrape_configs:
  - job_name: 'dropshipping-agent'
    static_configs:
      - targets: ['dropshipping-agent:9091']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import the provided dashboard from `grafana/dashboards/dropshipping-agent.json` or create custom dashboards monitoring:

- Business metrics (revenue, ROAS, campaigns)
- System metrics (CPU, memory, errors)
- API metrics (request rate, latency)
- Agent decisions and performance

### Alerts Configuration

Create `alerts.yml`:

```yaml
groups:
  - name: dropshipping-alerts
    rules:
      - alert: LowBalance
        expr: business_net_worth < 100
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Agent balance critically low"
          description: "Net worth is {{ $value }}, bankruptcy risk"
      
      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/second"
      
      - alert: NoCampaignsRunning
        expr: business_campaigns_active == 0
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "No active campaigns"
          description: "Agent has no active campaigns running"
```

## Maintenance

### Regular Tasks

1. **Daily**
   - Check agent health status
   - Review error logs
   - Monitor financial metrics

2. **Weekly**
   - Review campaign performance
   - Check API usage and costs
   - Rotate logs if needed

3. **Monthly**
   - Update dependencies
   - Review and optimize configurations
   - Backup audit trails

### Backup Strategy

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="/backups/dropshipping-agent"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR/$DATE

# Backup logs
tar -czf $BACKUP_DIR/$DATE/logs.tar.gz ./logs

# Backup audit trail
tar -czf $BACKUP_DIR/$DATE/audit.tar.gz ./audit

# Backup database/state if applicable
docker exec dropshipping-agent tar -czf - /app/data > $BACKUP_DIR/$DATE/data.tar.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;
```

### Updates and Upgrades

1. **Test in staging first**
```bash
docker build -t dropshipping-agent:staging .
docker run -d --name staging-test dropshipping-agent:staging
# Run tests against staging
```

2. **Blue-Green Deployment**
```bash
# Deploy new version
docker-compose -f docker-compose.blue.yml up -d

# Test new version
curl http://localhost:3001/health

# Switch traffic
# Update load balancer or proxy

# Remove old version
docker-compose -f docker-compose.green.yml down
```

## Troubleshooting

### Common Issues

1. **Agent not starting**
   - Check API keys are set correctly
   - Verify Docker has enough memory
   - Review logs: `docker-compose logs dropshipping-agent`

2. **High memory usage**
   - Reduce `MAX_CONCURRENT_CAMPAIGNS`
   - Decrease `MEMORY_RETENTION_DAYS`
   - Enable memory pruning more frequently

3. **API rate limits**
   - Check circuit breaker logs
   - Increase `RETRY_DELAY_MS`
   - Consider implementing request queuing

4. **Bankruptcy occurring**
   - Review campaign performance metrics
   - Check if conservative mode is activating
   - Analyze decision logs for patterns

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Health Checks

```bash
# Check API health
curl http://localhost:3000/health

# Check metrics endpoint
curl http://localhost:3000/metrics

# View recent logs
curl http://localhost:3000/logs?limit=50
```

### Support

For additional help:
1. Check logs in `./logs` directory
2. Review audit trail in `./audit`
3. Open an issue on GitHub
4. Consult the API documentation