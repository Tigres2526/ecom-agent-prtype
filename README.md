Ecom Agent

An autonomous AI-powered agent that manages ecom businesses, making intelligent decisions about product research, campaign management, and financial optimization. Built with TypeScript and powered by Grok-4.

## Features

- 🤖 **Autonomous Operation**: Runs continuously for 200+ days making independent business decisions
- 📱 **Multi-Platform Support**: Manages campaigns on Facebook, TikTok, and Google Ads
- 🔍 **Intelligent Product Research**: Discovers winning products across multiple categories
- 💰 **Financial Management**: Tracks ROAS, manages budgets, and prevents bankruptcy
- 🧠 **Memory System**: Long-term memory with vector search for learning from past decisions
- 🛡️ **Error Recovery**: Circuit breakers and recovery strategies for API failures
- 📊 **Comprehensive Logging**: Detailed audit trail and monitoring of all decisions
- 🌐 **REST API**: Full API for monitoring and controlling the agent
- 📈 **Web Interface**: Real-time dashboard for simulation monitoring
- 🎯 **Marketing Angles**: AI-generated creative angles and A/B testing
- 📦 **Order Tracking**: Supplier integration and fulfillment management
- ⚡ **Performance Optimized**: Handles 100+ concurrent campaigns efficiently

## Quick Start

### Prerequisites

- Node.js 20 or later
- Docker and Docker Compose (for containerized deployment)
- Grok-4 API key
- OpenAI API key (for embeddings)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/dropshipping-ai-agent.git
   cd dropshipping-ai-agent
   ```

2. **Run the setup script:**
   ```bash
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

   Or deploy with Docker:
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

## Architecture

```
├── src/
│   ├── agent/          # Core agent logic (DecisionEngine, ContextManager, etc.)
│   ├── memory/         # Memory system with vector search
│   ├── tools/          # Business tools (product research, campaign management)
│   ├── models/         # Data models (Product, Campaign, AgentState)
│   ├── simulation/     # Simulation engine for testing
│   ├── api/           # REST API server
│   ├── logging/       # Logging, monitoring, and audit trail
│   └── integration/   # End-to-end integration tests
├── docs/              # Documentation
├── scripts/           # Deployment and setup scripts
└── public/            # Web interface assets
```

## Configuration

### Required Environment Variables

- `GROK_API_KEY`: Your Grok-4 API key
- `OPENAI_API_KEY`: Your OpenAI API key for embeddings

### Optional Platform APIs

- Facebook Ads: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_ACCESS_TOKEN`
- TikTok Ads: `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`, `TIKTOK_ACCESS_TOKEN`
- Google Ads: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
- Shopify: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`
- BigCommerce: `BIGCOMMERCE_CLIENT_ID`, `BIGCOMMERCE_ACCESS_TOKEN`

See `.env.example` for all configuration options.

## Usage

### Running a Simulation

```bash
npm run simulate
```

This starts a full dropshipping simulation with the AI agent making autonomous decisions.

### Starting the API Server

```bash
npm run api
```

Access the API at `http://localhost:3000`. See [API Documentation](docs/API.md) for endpoints.

### Web Interface

Open `http://localhost:3000` in your browser to access the real-time simulation dashboard.

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Performance benchmarks
npm run test:performance
```

## Development

### Building from Source

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Project Structure

- **Agent Core**: The main decision-making engine that orchestrates all operations
- **Memory System**: Stores and retrieves past experiences using vector embeddings
- **Tool System**: Modular tools for specific tasks (product research, campaign management)
- **Financial Tracker**: Manages budgets, tracks spending, and prevents bankruptcy
- **Context Manager**: Maintains conversation context within token limits
- **Error Recovery**: Handles API failures with circuit breakers and retry logic

## Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# With monitoring stack (Prometheus + Grafana)
docker-compose --profile monitoring up -d
```

### Production Considerations

1. **API Keys**: Ensure all required API keys are properly configured
2. **Resource Limits**: Set appropriate memory and CPU limits in Docker
3. **Monitoring**: Enable Prometheus/Grafana for production monitoring
4. **Backups**: Regular backups of logs and audit trail
5. **Security**: Use HTTPS, enable API authentication, and secure your keys

## Monitoring

The agent provides comprehensive monitoring through:

- **Logs**: Structured logging with different levels (logs directory)
- **Metrics**: Prometheus-compatible metrics endpoint
- **Audit Trail**: Immutable audit log with hash chain integrity
- **Alerts**: Configurable alerts for critical conditions
- **Web Dashboard**: Real-time status and metrics visualization

## API Reference

The agent exposes a REST API for:

- Starting and stopping simulations
- Monitoring agent status and metrics
- Executing specific actions
- Retrieving logs and audit trails
- Real-time WebSocket events

See [API Documentation](docs/API.md) for detailed endpoint information.

## Safety Features

- **Bankruptcy Protection**: Monitors balance and stops if negative for 10+ days
- **Conservative Mode**: Activates when capital is low
- **ROAS Thresholds**: Minimum 1.5x return required for campaigns
- **Error Recovery**: Automatic recovery from API failures
- **Memory Pruning**: Removes old memories to maintain performance

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

The project includes comprehensive test coverage:

- Unit tests for all components
- Integration tests for end-to-end workflows
- Performance benchmarks
- Market condition simulations
- Bankruptcy scenario tests

Run tests with:
```bash
npm test
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built on the Vending-Bench architecture
- Powered by Grok-4 for decision making
- Uses OpenAI embeddings for memory search

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check the [API Documentation](docs/API.md)
- Review the [CLAUDE.md](CLAUDE.md) file for development guidance
