# ════════════════════════════════════════════════════════════════════════════════
# Sakila Facturación Electrónica - Imagen multi-stage con usuario no-root
# Prototipo académico NO certificado por el SIN.
# No incluye secretos ni material criptográfico real.
# ════════════════════════════════════════════════════════════════════════════════

# ── Base común: dependencias reproducibles ──────────────────────────────────
FROM node:20.18.1-alpine3.20 AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── Builder: genera Prisma Client y compila TypeScript ──────────────────────
FROM base AS builder
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build

# ── Desarrollo: código fuente, migraciones y recarga en caliente ────────────
FROM base AS dev
ENV NODE_ENV=development
WORKDIR /app
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$RUN_SEED\" = \"true\" ]; then npx ts-node prisma/seed.ts; fi && npm run start:dev"]

# ── Runner de producción: usuario no-root, solo artefactos compilados ───────
FROM node:20.18.1-alpine3.20 AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nestjs && \
    mkdir -p /home/nestjs && chown -R nestjs:nodejs /home/nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --chown=nestjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=12 --start-period=40s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
