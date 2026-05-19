# FinFlow

> A microservices-based digital banking platform — university SOA project.

FinFlow is a polyglot-protocol, event-driven banking backend: **REST + GraphQL** at the edge, **gRPC** between services, and **Kafka** for async events. Three independent microservices (Auth, Transaction, Notification), a single Gateway, and three databases (SQLite × 2 + RxDB) demonstrate per-service persistence and loose coupling.

---

## Architecture

```
                  ┌────────────────────────────────────────────┐
                  │              Clients                       │
                  │  curl  •  Postman  •  HTML test client     │
                  └─────────────────┬──────────────────────────┘
                                    │ REST / GraphQL  (HTTP :3000)
                                    ▼
                         ┌──────────────────────┐
                         │       GATEWAY        │
                         │ Express + Apollo GQL │
                         │  JWT auth middleware │
                         └─────────┬────────────┘
                                   │ gRPC
              ┌────────────────────┼─────────────────────┐
              ▼                    ▼                     ▼
      ┌──────────────┐    ┌──────────────────┐   ┌────────────────────┐
      │ auth-service │    │transaction-svc   │   │notification-svc    │
      │   :50051     │    │     :50052       │   │     :50053         │
      │  SQLite      │    │  SQLite (atomic) │   │  RxDB (in-memory)  │
      └──────┬───────┘    └────────┬─────────┘   └─────────▲──────────┘
             │                     │                       │
             │ produces            │ produces              │ consumes
             ▼                     ▼                       │
       user.registered   account.created,                  │
                         transaction.created               │
                                   └───────► Kafka ────────┘
                                          (:9092)
```

---

## Tech stack

| Layer            | Tech                                                     |
| ---------------- | -------------------------------------------------------- |
| Runtime          | Node.js 20+ (ESM)                                        |
| Gateway          | Express 4, Apollo Server 4, Swagger UI                   |
| Inter-service    | gRPC (`@grpc/grpc-js`, `@grpc/proto-loader`)             |
| Auth             | JWT (jsonwebtoken) + bcryptjs                            |
| Messaging        | Apache Kafka (Confluent images) + KafkaJS                |
| Auth DB          | SQLite (`better-sqlite3`)                                |
| Transaction DB   | SQLite (`better-sqlite3`) with atomic transactions       |
| Notification DB  | **RxDB v15** (NoSQL) — memory storage                    |
| Orchestration    | Docker Compose                                           |
| Observability    | Kafka UI (`localhost:8080`), Swagger (`/api-docs`)       |

---

## Folder structure

```
finflow/
├── docker-compose.yml
├── gateway/                  Express + Apollo + REST/GraphQL/Swagger
│   └── src/
│       ├── rest/             auth, accounts, transactions, notifications
│       ├── graphql/          schema.js, resolvers.js
│       ├── config/           gRPC clients (promisified)
│       └── middleware/       JWT auth, error handler
├── services/
│   ├── auth-service/         JWT issue/verify, users, Kafka producer
│   ├── transaction-service/  Accounts, deposits, withdrawals, transfers
│   └── notification-service/ RxDB + Kafka consumer + gRPC
│       └── src/
│           ├── db/           rxdb.js, notifications.schema.js
│           ├── services/     notification.service.js
│           ├── kafka/        consumer.js (3 topics, idempotency)
│           ├── grpc/         notification.handler.js
│           └── index.js
├── shared/
│   ├── proto/                auth.proto, transaction.proto, notification.proto
│   └── src/                  logger.js
├── client/                   Minimal HTML+JS test client
└── docs/                     POSTMAN_COLLECTION.json
```

---

## Prerequisites

- **Node.js 20+**
- **Docker** + **Docker Compose**
- (Optional) curl, jq, Postman

---

## Install & Run (3 commands)

```bash
npm install
docker compose up -d --build
# wait ~15s for Kafka & services
curl http://localhost:3000/health
```

URLs once up:

| URL                                    | What                  |
| -------------------------------------- | --------------------- |
| http://localhost:3000/api              | REST root             |
| http://localhost:3000/graphql          | GraphQL playground    |
| http://localhost:3000/api-docs         | Swagger UI            |
| http://localhost:8080                  | Kafka UI              |

To run locally without Docker:

```bash
docker compose up -d zookeeper kafka kafka-ui    # infra only
npm run dev                                       # all 4 node services in parallel
```

---

## REST endpoints

> All `/api/accounts`, `/api/transactions`, `/api/notifications` routes require `Authorization: Bearer <token>`.

### Auth

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123","full_name":"Alice"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret123"}'
```

### Accounts

```bash
# Create account (default currency EUR)
curl -X POST http://localhost:3000/api/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currency":"EUR"}'

# List my accounts
curl http://localhost:3000/api/accounts -H "Authorization: Bearer $TOKEN"

# Single account
curl http://localhost:3000/api/accounts/<id> -H "Authorization: Bearer $TOKEN"
```

### Transactions

```bash
curl -X POST http://localhost:3000/api/transactions/deposit  \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"account_id":"<id>","amount":100,"description":"seed"}'

curl -X POST http://localhost:3000/api/transactions/withdraw \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"account_id":"<id>","amount":20}'

curl -X POST http://localhost:3000/api/transactions/transfer \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"from_account_id":"<src>","to_account_id":"<dst>","amount":30}'

curl "http://localhost:3000/api/transactions/account/<accountId>" \
  -H "Authorization: Bearer $TOKEN"
```

### Notifications

```bash
curl http://localhost:3000/api/notifications -H "Authorization: Bearer $TOKEN"
curl -X PATCH http://localhost:3000/api/notifications/<id>/read \
  -H "Authorization: Bearer $TOKEN"
```

---

## GraphQL examples

Endpoint: `POST http://localhost:3000/graphql`

```graphql
mutation { register(email:"a@a.com", password:"secret123", fullName:"Alice") { token user { id email } } }

mutation { login(email:"a@a.com", password:"secret123") { token } }

query   { me { id email fullName } myAccounts { id iban balance currency } }

mutation { createAccount(currency:"EUR") { id iban } }

mutation { deposit(accountId:"<id>", amount: 100) { id type amount } }
mutation { transfer(fromAccountId:"<a>", toAccountId:"<b>", amount: 30) { id status } }

query    { myNotifications { id type title message read createdAt } unreadNotificationCount }
mutation { markNotificationAsRead(id:"<nid>") { id read } }
```

---

## Kafka topics

| Topic                  | Producer            | Consumer              | Payload (data fields)                                                   |
| ---------------------- | ------------------- | --------------------- | ----------------------------------------------------------------------- |
| `user.registered`      | auth-service        | notification-service  | `userId, email, fullName`                                               |
| `account.created`      | transaction-service | notification-service  | `accountId, userId, iban, currency, balance`                            |
| `transaction.created`  | transaction-service | notification-service  | `transactionId, type, amount, fromAccountId, toAccountId, fromUserId, toUserId, fromIban, toIban, currency, status, description` |

All events share the envelope: `{ eventId, eventType, timestamp, version, data }`.
The notification-service stores `eventId`s in an RxDB collection for idempotency.

---

## .proto contracts

- [shared/proto/auth.proto](shared/proto/auth.proto) — `AuthService` (Register, Login, VerifyToken, GetUser)
- [shared/proto/transaction.proto](shared/proto/transaction.proto) — `TransactionService` (CreateAccount, GetAccount, GetUserAccounts, Deposit, Withdraw, Transfer, GetHistory)
- [shared/proto/notification.proto](shared/proto/notification.proto) — `NotificationService` (GetUserNotifications, MarkAsRead, GetUnreadCount)

---

## Database schemas

### Auth (SQLite — `users`)
`id` PK • `email` UNIQUE • `password_hash` • `full_name` • `created_at`

### Transaction (SQLite — `accounts`, `transactions`)
`accounts(id PK, user_id, iban UNIQUE, currency, balance, created_at)`
`transactions(id PK, from_account_id?, to_account_id?, amount, type, status, description?, created_at)` — atomically updated within a single SQLite transaction.

### Notification (RxDB — `notifications`, `processed_events`)
`notifications { id PK, userId idx, type, title, message, read, createdAt idx }`
`processed_events { eventId PK, processedAt }` — enforces consumer idempotency.

> **Storage note:** the notification service uses `rxdb/plugins/storage-memory` for project simplicity. Swap for `storage-dexie` (browser) or `storage-mongodb` for persistence — only [services/notification-service/src/db/rxdb.js](services/notification-service/src/db/rxdb.js) changes.

---

## Known design tradeoff

The `transaction.created` event includes `fromUserId` / `toUserId` resolved at publish time by the transaction-service (it owns the `accounts` table). This keeps the notification-service stateless w.r.t. accounts and avoids an extra gRPC hop. The downside is a slightly fatter event payload — acceptable here.

---

## Team & contributions

| Member              | Day | Scope                                                                | %     |
| ------------------- | --- | -------------------------------------------------------------------- | ----- |
| **Amir Kerkeni**    | 1   | Project foundation, Docker Compose, gateway skeleton, proto contracts | 33%  |
| **Souleima Mahbouba** | 2   | Auth service (JWT + SQLite + bcrypt), Transaction service (atomic SQLite tx, Kafka producers) | 33% |
| **Hiba**            | 3   | Notification service (RxDB + Kafka consumer + gRPC), end-to-end integration, README, Postman, demo, HTML client | 34% |

---

## License

MIT — academic / educational use.
