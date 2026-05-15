FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY services/notification-service/package.json ./services/notification-service/
COPY shared/package.json ./shared/

RUN npm ci || npm install

COPY shared ./shared
COPY services/notification-service ./services/notification-service

WORKDIR /app/services/notification-service
EXPOSE 50053
CMD ["node", "src/index.js"]
