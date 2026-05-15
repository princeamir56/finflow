FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY gateway/package.json ./gateway/
COPY shared/package.json ./shared/

RUN npm ci --omit=dev || npm install --omit=dev

COPY shared ./shared
COPY gateway ./gateway

WORKDIR /app/gateway
EXPOSE 3000
CMD ["node", "src/index.js"]
