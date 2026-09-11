# Multi-stage build for MBF Monorepo (Angular 18 + Node.js Express + SQLite)
FROM node:22-alpine AS builder

WORKDIR /app

# Install root & frontend & backend dependencies
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

RUN cd frontend && npm install
RUN cd backend && npm install

# Copy source code and build
COPY frontend ./frontend
COPY backend ./backend

RUN cd frontend && npm run build
RUN cd backend && npm run build

# Production Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy compiled backend & database files
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/src/db/schema.sql ./src/db/schema.sql
COPY --from=builder /app/frontend/dist/frontend/browser ./frontend/dist/frontend/browser

# Create data and uploads directories
RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

CMD ["node", "dist/server.js"]
