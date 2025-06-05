# ---------- Build Stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit-dev

# Copy source
COPY . .

# Build static site
RUN npm run build:prod

# ---------- Production Stage ----------
FROM node:20-alpine AS production

# Create a non-privileged user and group
RUN addgroup -S appgroup && adduser -S -G appgroup appuser

# Install a simple static file server
RUN npm install -g serve@14.2.0

# Copy built files from builder
COPY --from=builder --chown=appuser:appgroup /app/dist /app/dist

WORKDIR /app

# Switch to the non-root user
USER appuser

# Expose the port serve will listen on (Cloud Run uses PORT env var)
# serve defaults to 3000, but will use process.env.PORT if available and -l is not set.
EXPOSE ${PORT:-3000}

# Serve the app. serve will pick up the PORT environment variable from Cloud Run.
CMD ["serve", "dist"]
