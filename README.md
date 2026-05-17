# FinFlow

> A microservices-based digital banking platform  university SOA project.

FinFlow demonstrates a polyglot-protocol, event-driven banking backend: REST + GraphQL at the edge, gRPC between services, and Kafka for async events.

## Tech stack

| Layer            | Tech                                                     |
| ---------------- | -------------------------------------------------------- |
| Runtime          | Node.js 20+, ES Modules                                  |
| API Gateway      | Express 4 + Apollo Server 4 (GraphQL) + Swagger UI       |
| Service RPC      | gRPC (HTTP/2) with Protocol Buffers                      |
| Async messaging  | Apache Kafka (Confluent 7.5) + kafkajs                   |
| SQL storage      | SQLite via `better-sqlite3` (auth, transaction services) |
| NoSQL storage    | RxDB (notification service)                              |
| Auth             | JWT (jsonwebtoken) + bcryptjs                            |
| Orchestration    | Docker Compose                                           |
| Monorepo tooling | npm workspaces                                           |

## Architecture (overview)

```
┌─────────┐    REST / GraphQL    ┌─────────────┐         ┌──────────────────────┐
│ Client  │ ───────────────────▶ │  Gateway    │ ──gRPC─▶ │ auth-service (SQLite)│
└─────────┘                      │  (Express + │ ──gRPC─▶ │ transaction-service  │
                                 │   Apollo)   │ ──gRPC─▶ │ notification-service │
                                 └─────────────┘         └──────────┬───────────┘
                                                                    │
                                                        Kafka events│
                                                                    ▼
                                                            ┌────────────┐
                                                            │   Kafka    │
                                                            └────────────┘
```

Full details in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Repo layout

```
finflow/
├─ gateway/                  # API gateway (REST + GraphQL + Swagger)
├─ services/
│  ├─ auth-service/          # gRPC, SQLite, JWT
│  ├─ transaction-service/   # gRPC, SQLite
│  └─ notification-service/  # gRPC, RxDB, Kafka consumer
├─ shared/
│  ├─ proto/                 # .proto contracts (source of truth)
│  └─ src/logger.js          # shared winston logger
├─ docker-compose.yml
├─ .env.example
└─ package.json              # npm workspaces root
```

## Prerequisites

- Node.js 20+ and npm 10+
- Docker Desktop (with Compose v2)
- A POSIX-ish shell or PowerShell

## Quick start

```bash
# 1. Clone and install
git clone <repo-url> finflow
cd finflow
cp .env.example .env
npm install

# 2. Bring up the whole stack (Kafka + services + gateway)
docker compose up -d --build

# 3. Verify
curl http://localhost:3000/health
# → { "status": "ok", "service": "gateway", "timestamp": "..." }
```

Useful URLs:

| URL                                | What                                       |
| ---------------------------------- | ------------------------------------------ |
| http://localhost:3000/health       | Gateway liveness probe                     |
| http://localhost:3000/api-docs     | Swagger UI (REST contract)                 |
| http://localhost:3000/graphql      | Apollo Sandbox / GraphQL endpoint          |
| http://localhost:8080              | Kafka UI                                   |

## Local dev (without Docker)

```bash
npm install
# Kafka only via Docker:
docker compose up -d zookeeper kafka kafka-ui
# All services in dev mode (watch):
npm run dev
```

## Day-by-day plan

| Day | Owner    | Scope                                                              |
| --- | -------- | ------------------------------------------------------------------ |
| 1   | Amir     | Monorepo scaffolding, proto contracts, gateway, Docker, docs       |
| 2   | Souleima | Implement `auth-service` and `transaction-service` business logic  |
| 3   | Hiba     | Implement `notification-service`, Kafka producers/consumers, tests |

## Team

- **Amir Kerkeni** — architecture & gateway
- **Souleima** — auth & transactions
- **Hiba** — notifications & events

## To be filled later

- [ ] Sequence diagrams for `transfer` and `notify` flows
- [ ] Kafka topic catalogue
- [ ] Test strategy + CI workflow
- [ ] Postman / Bruno collection link
- [ ] Demo screencast link

## License

Kerkeni Amir | Migaou Souleima Mahbouba | Maatoug Hiba
