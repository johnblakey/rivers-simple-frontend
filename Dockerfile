# Build stage - compile TypeScript and bundle assets
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Set build-time environment variables (Firebase config, API URLs, etc.)
ARG FIREBASE_API_KEY_ARG
ARG FIREBASE_AUTH_DOMAIN_ARG
ARG FIREBASE_PROJECT_ID_ARG
ARG FIREBASE_STORAGE_BUCKET_ARG
ARG FIREBASE_MESSAGING_SENDER_ID_ARG
ARG FIREBASE_APP_ID_ARG
ARG API_BASE_URL_ARG

ENV VITE_FIREBASE_API_KEY=${FIREBASE_API_KEY_ARG}
ENV VITE_FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN_ARG}
ENV VITE_FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID_ARG}
ENV VITE_FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET_ARG}
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=${FIREBASE_MESSAGING_SENDER_ID_ARG}
ENV VITE_FIREBASE_APP_ID=${FIREBASE_APP_ID_ARG}
ENV VITE_API_BASE_URL=${API_BASE_URL_ARG}

# Copy source and build
COPY . .
RUN npm run build:prod

# Production stage - serve static files
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install static file server
RUN npm install -g serve@14.2.0

# Copy built files with proper ownership
COPY --from=builder --chown=appuser:appgroup /app/dist /app/dist

WORKDIR /app
USER appuser

EXPOSE ${PORT:-3000}

# Serve with SPA support (handles client-side routing)
CMD ["serve", "dist", "-s"]
