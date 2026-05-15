FROM node:20-alpine
RUN apk add --no-cache python3 make g++ \
  && ln -sf python3 /usr/bin/python
WORKDIR /app

COPY package.json package-lock.json* ./
COPY services/transaction-service/package.json ./services/transaction-service/
COPY shared/package.json ./shared/

RUN npm ci || npm install

COPY shared ./shared
COPY services/transaction-service ./services/transaction-service

WORKDIR /app/services/transaction-service
EXPOSE 50052
CMD ["node", "src/index.js"]
