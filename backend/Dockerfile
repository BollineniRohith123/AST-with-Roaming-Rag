FROM node:22-slim AS base

# Create a non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs -m -d /home/nodejs nodejs

# Install build dependencies
FROM base AS deps
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    python3 \
    libssl-dev \
    libkrb5-dev \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Build stage
FROM deps AS build
WORKDIR /app

# Copy the rest of the app
COPY . .

# Create necessary directories
RUN mkdir -p repos lib logs

# Production stage
FROM base AS production
WORKDIR /app

# Copy from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package*.json ./

# Copy the logs directory
COPY --from=build /app/logs ./logs

# Create directories and set permissions
RUN mkdir -p repos lib logs && \
    chown -R nodejs:nodejs /app

# Set the user to nodejs
USER nodejs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Expose port
EXPOSE 3001

# Run the app
CMD ["node", "src/index.js"]