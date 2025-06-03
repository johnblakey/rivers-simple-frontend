# ---------- Build Stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build static site
RUN npm run prod:build

# ---------- Production Stage ----------
FROM node:20-alpine AS production

# Install a simple static file server
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist /app/dist

WORKDIR /app

# Serve the app
CMD ["serve", "-s", "dist", "-l", "3000"]
