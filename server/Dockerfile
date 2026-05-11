FROM node:20-slim

WORKDIR /app

# Copy dependency manifests
COPY server/package*.json ./server/

# Install dependencies
RUN cd server && npm install --production

# Copy source code
COPY shared/ ./shared/
COPY server/ ./server/

# Environment variables
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

# Run the server
CMD ["node", "server/index.js"]
