# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy public files for API
COPY --chown=nodejs:nodejs src/api/public ./dist/api/public

# Create directories for logs and data
RUN mkdir -p /app/logs /app/audit /app/data && \
    chown -R nodejs:nodejs /app/logs /app/audit /app/data

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Set environment variables
ENV NODE_ENV=production \
    LOG_DIR=/app/logs \
    AUDIT_DIR=/app/audit \
    DATA_DIR=/app/data

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command - can be overridden
CMD ["node", "dist/api/server.js"]