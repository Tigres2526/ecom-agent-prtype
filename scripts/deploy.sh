#!/bin/bash

# Deployment script for Dropshipping AI Agent
set -e

echo "🚀 Starting deployment of Dropshipping AI Agent..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please create one from .env.example"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Validate required environment variables
required_vars=("GROK_API_KEY" "OPENAI_API_KEY")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

echo "✅ Environment variables validated"

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t dropshipping-ai-agent:latest .

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down || true

# Start services
echo "🚦 Starting services..."
if [ "$1" == "--with-monitoring" ]; then
    echo "📊 Starting with monitoring services..."
    docker-compose --profile monitoring up -d
else
    docker-compose up -d
fi

# Wait for health check
echo "⏳ Waiting for services to be healthy..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker-compose ps | grep -q "healthy"; then
        echo "✅ Services are healthy!"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
    echo "   Waiting... ($elapsed/$timeout seconds)"
done

if [ $elapsed -ge $timeout ]; then
    echo "❌ Error: Services failed to become healthy within $timeout seconds"
    docker-compose logs
    exit 1
fi

# Show service status
echo "📋 Service status:"
docker-compose ps

# Show logs location
echo ""
echo "📄 Logs are available at:"
echo "   - Application logs: ./logs"
echo "   - Audit trail: ./audit"
echo "   - Container logs: docker-compose logs -f"

# Show access URLs
echo ""
echo "🌐 Access URLs:"
echo "   - API: http://localhost:3000"
echo "   - API Health: http://localhost:3000/health"
echo "   - API Docs: http://localhost:3000/docs"
if [ "$1" == "--with-monitoring" ]; then
    echo "   - Prometheus: http://localhost:9090"
    echo "   - Grafana: http://localhost:3001 (admin/$(grep GRAFANA_PASSWORD .env | cut -d '=' -f2))"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop services: docker-compose down"
echo "To restart services: docker-compose restart"