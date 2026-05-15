# Architecture

> Stub — Amir will expand this with the architecture doc provided separately. The skeleton is committed so teammates can link to it.

## Sections to fill

1. **Context diagram** — actors, external systems, boundary of FinFlow.
2. **Container diagram** — gateway, three services, Kafka, databases.
3. **Communication patterns**
   - Sync: client ⇄ gateway (REST/GraphQL), gateway ⇄ services (gRPC).
   - Async: services ⇄ Kafka (events: `user.registered`, `transaction.created`, `notification.dispatched`, …).
4. **Data ownership** — each service owns its DB; no cross-service SQL.
5. **Auth flow** — JWT issued by `auth-service`, validated at the gateway via `AuthService.ValidateToken` gRPC.
6. **Error handling** — gRPC status codes mapped to HTTP at the gateway (see `gateway/src/utils/grpc-error.js`).
7. **Deployment** — `docker compose` for now; future Kubernetes optional.
8. **ADRs** — record significant decisions here (SQLite vs Postgres, RxDB vs Mongo, etc.).
