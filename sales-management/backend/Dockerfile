# ─── Base stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ─── Development stage ─────────────────────────────────────────────────────────
FROM base AS development
RUN npm ci
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ─── Production stage ──────────────────────────────────────────────────────────
FROM base AS production
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["node", "src/app.js"]
