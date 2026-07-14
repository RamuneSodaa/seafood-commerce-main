#!/bin/bash
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
PICKUP_ID="${1:-}"
CUSTOMER_ID="${2:-}"
PICKUP_CODE="${3:-}"
PAID_AMOUNT_CENTS="${4:-10800}"
PAYREF_PICKUP="pickup-$(date +%s)"

if [[ -z "$PICKUP_ID" || -z "$CUSTOMER_ID" || -z "$PICKUP_CODE" ]]; then
  echo "Usage: $0 <order-id> <customer-id> <pickup-code> [paid-amount-cents]"
  exit 1
fi

echo "== pickup 当前状态 =="
curl -sS \
  -H "x-role: CUSTOMER" \
  -H "x-user-id: $CUSTOMER_ID" \
  "$BASE/orders/$PICKUP_ID"
echo
echo

echo "== pickup 支付 =="
curl -sS -X POST \
  -H "x-role: CUSTOMER" \
  -H "x-user-id: $CUSTOMER_ID" \
  -H "Content-Type: application/json" \
  -d "{\"paymentRef\":\"$PAYREF_PICKUP\",\"paidAmountCents\":$PAID_AMOUNT_CENTS}" \
  "$BASE/orders/$PICKUP_ID/mark-paid"
echo
echo

echo "== pickup 备货完成 =="
curl -sS -X POST \
  -H "x-role: STORE" \
  "$BASE/orders/$PICKUP_ID/ready-for-pickup"
echo
echo

echo "== pickup 核销提货 =="
curl -sS -X POST \
  -H "x-role: STORE" \
  -H "Content-Type: application/json" \
  -d "{\"pickupCode\":\"$PICKUP_CODE\"}" \
  "$BASE/orders/$PICKUP_ID/complete-pickup"
echo
echo

echo "== pickup 最终状态 =="
curl -sS \
  -H "x-role: CUSTOMER" \
  -H "x-user-id: $CUSTOMER_ID" \
  "$BASE/orders/$PICKUP_ID"
echo
echo

echo "== pickup 状态日志 =="
curl -sS \
  -H "x-role: STORE" \
  "$BASE/orders/$PICKUP_ID/status-logs"
echo
echo
