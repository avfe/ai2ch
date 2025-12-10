FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

# Устанавливаем зависимости и собираем native-модуль better-sqlite3
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 build-essential ca-certificates \
    && npm ci --omit=dev \
    && apt-get purge -y --auto-remove python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN mkdir -p data && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
