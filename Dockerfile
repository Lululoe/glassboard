# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production Stage
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY server ./server
COPY theme.yaml ./theme.yaml
# server.js imports config.js which might rely on other server files, so we copy the whole server dir.

EXPOSE 3001

CMD ["npm", "run", "start:server"]
