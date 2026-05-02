# ─── Base stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json ./

# ─── Development stage ─────────────────────────────────────────────────────────
FROM base AS development
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ─── Production stage ──────────────────────────────────────────────────────────
FROM base AS production
RUN npm install --omit=dev && npm cache clean --force
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["node", "src/app.js"]
