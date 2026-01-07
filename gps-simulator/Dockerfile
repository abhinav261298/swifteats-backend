# Dockerfile for GPS Simulator

FROM node:20-alpine

# Install dumb-init
RUN apk add --no-cache dumb-init curl

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY --chown=nodejs:nodejs index.js ./
COPY --chown=nodejs:nodejs .env.example ./.env

# Switch to non-root user
USER nodejs

# Use dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Start simulator
CMD ["node", "index.js"]
