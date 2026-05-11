# Stage 1: Build the React application
FROM node:20 AS build

WORKDIR /app

# Copy dependency manifests
COPY client/package*.json ./client/

# Install dependencies
RUN cd client && npm install

# Copy source code (including shared logic)
COPY shared/ ./shared/
COPY client/ ./client/

# Build the production assets
RUN cd client && npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:stable-alpine

# Copy built assets from Stage 1
COPY --from=build /app/client/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
