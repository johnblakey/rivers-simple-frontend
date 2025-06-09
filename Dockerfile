# ---------- Build Stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit-dev

# Declare build arguments for Firebase and API configuration
ARG FIREBASE_API_KEY_ARG
ARG FIREBASE_AUTH_DOMAIN_ARG
ARG FIREBASE_PROJECT_ID_ARG
ARG FIREBASE_STORAGE_BUCKET_ARG
ARG FIREBASE_MESSAGING_SENDER_ID_ARG
ARG FIREBASE_APP_ID_ARG
ARG API_BASE_URL_ARG

# Set VITE_ prefixed environment variables from build arguments for the build process
ENV VITE_FIREBASE_API_KEY=${FIREBASE_API_KEY_ARG}
ENV VITE_FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN_ARG}
ENV VITE_FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID_ARG}
ENV VITE_FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET_ARG}
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=${FIREBASE_MESSAGING_SENDER_ID_ARG}
ENV VITE_FIREBASE_APP_ID=${FIREBASE_APP_ID_ARG}
ENV VITE_API_BASE_URL=${API_BASE_URL_ARG}

# Copy source
COPY . .

# Build static site
RUN npm run build:prod

# Ensure the processed about.html is served:
# Vite processes public/about.html (specified as an input in vite.config.js)
# and outputs it to dist/public/about.html.
# Vite also copies the original public/about.html to dist/about.html (unprocessed).
# This move ensures the processed version is at dist/about.html, overwriting the unprocessed one.
RUN if [ -f /app/dist/public/about.html ]; then mv -f /app/dist/public/about.html /app/dist/about.html; fi

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
EXPOSE ${PORT:-3000}

# Serve the app. serve will pick up the PORT environment variable from Cloud Run.
CMD ["serve", "dist"]
