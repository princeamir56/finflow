#!/usr/bin/env bash
# FinFlow end-to-end demo: register, account, deposit, transfer, notifications.
# Requires: curl, jq.  Gateway must be running on $BASE (default http://localhost:3000).

set -euo pipefail
BASE="${BASE:-http://localhost:3000}"
STAMP=$(date +%s)
ALICE="alice_${STAMP}@example.com"
BOB="bob_${STAMP}@example.com"
PASS="secret123"

step() { echo; echo "▶ $*"; }
pause() { sleep "${1:-1}"; }

step "0. Health check"
curl -s "$BASE/health" | jq .

step "1. Register Alice ($ALICE)"
ALICE_REG=$(curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ALICE\",\"password\":\"$PASS\",\"full_name\":\"Alice\"}")
echo "$ALICE_REG" | jq .
ALICE_TOKEN=$(echo "$ALICE_REG" | jq -r .token)
ALICE_ID=$(echo "$ALICE_REG"   | jq -r .user.id)

pause 1
step "2. Alice's notifications (expect WELCOME)"
curl -s "$BASE/api/notifications" -H "Authorization: Bearer $ALICE_TOKEN" | jq .

step "3. Alice creates an EUR account"
ALICE_ACC=$(curl -s -X POST "$BASE/api/accounts" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currency":"EUR"}')
echo "$ALICE_ACC" | jq .
ALICE_ACC_ID=$(echo "$ALICE_ACC" | jq -r .id)

pause 1
step "4. Alice notifications (expect WELCOME + ACCOUNT_CREATED)"
curl -s "$BASE/api/notifications" -H "Authorization: Bearer $ALICE_TOKEN" | jq '.[].title'

step "5. Alice deposits 100 EUR"
curl -s -X POST "$BASE/api/transactions/deposit" \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d "{\"account_id\":\"$ALICE_ACC_ID\",\"amount\":100,\"description\":\"seed\"}" | jq .

pause 1
step "6. Alice notifications (expect Deposit received)"
curl -s "$BASE/api/notifications" -H "Authorization: Bearer $ALICE_TOKEN" | jq '.[].title'

step "7. Register Bob ($BOB) + create his account"
BOB_REG=$(curl -s -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BOB\",\"password\":\"$PASS\",\"full_name\":\"Bob\"}")
BOB_TOKEN=$(echo "$BOB_REG" | jq -r .token)
BOB_ACC=$(curl -s -X POST "$BASE/api/accounts" \
  -H "Authorization: Bearer $BOB_TOKEN" -H "Content-Type: application/json" \
  -d '{"currency":"EUR"}')
BOB_ACC_ID=$(echo "$BOB_ACC" | jq -r .id)
echo "Bob account: $BOB_ACC_ID"

pause 1
step "8. Alice transfers 30 EUR to Bob"
curl -s -X POST "$BASE/api/transactions/transfer" \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d "{\"from_account_id\":\"$ALICE_ACC_ID\",\"to_account_id\":\"$BOB_ACC_ID\",\"amount\":30}" | jq .

pause 1
step "9. Alice notifications (expect TRANSFER_DEBIT)"
curl -s "$BASE/api/notifications" -H "Authorization: Bearer $ALICE_TOKEN" | jq '.[].title'

step "10. Bob notifications (expect TRANSFER_CREDIT + welcome + account)"
curl -s "$BASE/api/notifications" -H "Authorization: Bearer $BOB_TOKEN" | jq '.[].title'

step "11. GraphQL: myNotifications for Alice"
curl -s -X POST "$BASE/graphql" \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"{ myNotifications { id type title read } unreadNotificationCount }"}' | jq .

step "12. Mark Alice's first notification as read (REST)"
N_ID=$(curl -s "$BASE/api/notifications" -H "Authorization: Bearer $ALICE_TOKEN" | jq -r '.[0].id')
curl -s -X PATCH "$BASE/api/notifications/$N_ID/read" -H "Authorization: Bearer $ALICE_TOKEN" | jq .

step "13. Mark another as read (GraphQL)"
N_ID2=$(curl -s "$BASE/api/notifications" -H "Authorization: Bearer $ALICE_TOKEN" | jq -r '.[1].id')
curl -s -X POST "$BASE/graphql" \
  -H "Authorization: Bearer $ALICE_TOKEN" -H "Content-Type: application/json" \
  -d "{\"query\":\"mutation { markNotificationAsRead(id: \\\"$N_ID2\\\") { id read } }\"}" | jq .

echo; echo "✔ Demo complete."
