# ============================================================
# Stage 1: Builder — install dependencies and compile TypeScript
# ============================================================
# Build context MUST be the monorepo root.
# docker build -f apps/backend/Dockerfile .
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files for dependency resolution
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install all dependencies (including devDependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

# Build shared package first, then backend
RUN cd packages/shared && yarn build
RUN cd apps/backend && npx prisma generate && yarn build

# ============================================================
# Stage 2: Production — minimal runtime image
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy root workspace config for production install
COPY package.json yarn.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

# Install production dependencies only
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Copy built artifacts from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma

# Install curl for health checks
RUN apk add --no-cache curl

# Switch to non-root user
USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# In production, run Prisma migrations as a separate step (CI/CD or init container).
# This CMD starts the server only.
CMD ["node", "apps/backend/dist/index.js"]
