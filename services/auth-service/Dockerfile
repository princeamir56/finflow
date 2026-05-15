FROM node:20-alpine
RUN apk add --no-cache python3 make g++ \
  && ln -sf python3 /usr/bin/python
WORKDIR /app

COPY package.json package-lock.json* ./
COPY services/auth-service/package.json ./services/auth-service/
COPY shared/package.json ./shared/

RUN npm ci || npm install

COPY shared ./shared
COPY services/auth-service ./services/auth-service

WORKDIR /app/services/auth-service
EXPOSE 50051
CMD ["node", "src/index.js"]
