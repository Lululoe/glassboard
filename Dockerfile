# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production Stage
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY shared ./shared
# Default themes; mount a theme.yaml to override them.
COPY theme.example.yaml ./theme.example.yaml
# Glassboard runs as the image's unprivileged node user (uid 1000). It only writes to these:
# plugins, uploaded backgrounds, the layout overlay, and /app/data, the folder to mount to keep
# the layout and backgrounds (see docker-compose.yml). Everything else stays owned by root.
RUN mkdir -p /app/plugins /app/backgrounds /app/data \
    && touch /app/layout.yaml \
    && chown node:node /app/plugins /app/backgrounds /app/data /app/layout.yaml

USER node

EXPOSE 3001

CMD ["node", "server/server.js"]
