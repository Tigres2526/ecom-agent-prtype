#!/bin/bash

# Setup script for Dropshipping AI Agent
set -e

echo "🔧 Setting up Dropshipping AI Agent..."
echo ""

# Check Node.js version
echo "📋 Checking Node.js version..."
node_version=$(node -v 2>/dev/null || echo "not installed")
if [[ "$node_version" == "not installed" ]]; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 20 or later."
    exit 1
fi

major_version=$(echo $node_version | cut -d. -f1 | sed 's/v//')
if [ $major_version -lt 20 ]; then
    echo "❌ Error: Node.js version 20 or later is required. Current version: $node_version"
    exit 1
fi
echo "✅ Node.js version: $node_version"

# Check Docker installation
echo "📋 Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed. Please install Docker."
    exit 1
fi
echo "✅ Docker is installed"

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose is not installed. Please install docker-compose."
    exit 1
fi
echo "✅ docker-compose is installed"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p logs audit data

# Setup environment file
echo ""
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your API keys"
    echo ""
    read -p "Would you like to edit .env now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ${EDITOR:-nano} .env
    fi
else
    echo "✅ .env file already exists"
fi

# Run tests
echo ""
read -p "Would you like to run tests? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧪 Running tests..."
    npm test
fi

# Setup monitoring (optional)
echo ""
read -p "Would you like to set up monitoring (Prometheus/Grafana)? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📊 Setting up monitoring..."
    
    # Create Prometheus config
    cat > prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'dropshipping-agent'
    static_configs:
      - targets: ['dropshipping-agent:9091']
    metrics_path: '/metrics'
EOF
    
    # Create Grafana provisioning
    mkdir -p grafana/provisioning/datasources
    mkdir -p grafana/provisioning/dashboards
    
    cat > grafana/provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
EOF
    
    echo "✅ Monitoring configuration created"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys (if not already done)"
echo "2. Run './scripts/deploy.sh' to deploy the application"
echo "3. Or run 'npm run dev' for development mode"
echo ""
echo "For more information, see README.md"