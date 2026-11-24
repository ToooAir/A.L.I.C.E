FROM node:20-alpine

WORKDIR /app

# Node already honors TZ via its bundled ICU; tzdata makes system tools (date, logs) agree with it.
RUN apk add --no-cache tzdata

# Install exact locked dependency versions (discord.js 14.14.1) before copying source for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY alice.js ./
COPY server ./server

# Secrets live in server/config.js, which is mounted at runtime (see docker-compose.yml), never baked into the image.
USER node

CMD ["node", "alice.js"]
