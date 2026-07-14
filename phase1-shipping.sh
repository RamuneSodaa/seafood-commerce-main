#!/bin/bash
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
SHIPPING_ID="${1:-}"
CUSTOMER_ID="${2:-}"
PAID_AMOUNT_CENTS="${3:-10800}"
PAYREF_SHIP="ship-$(date +%s)"

if [[ -z "$SHIPPING_ID" || -z "$CUSTOMER_ID" ]]; then
  echo "Usage: $0 <order-id> <customer-id> [paid-amount-cents]"
  exit 1
fi

echo "== shipping 当前状态 =="
curl -sS \
  -H "x-role: CUSTOMER" \
  -H "x-user-id: $CUSTOMER_ID" \
  "$BASE/orders/$SHIPPING_ID"
echo
echo

echo "== shipping 支付 =="
curl -sS -X POST \
  -H "x-role: CUSTOMER" \
  -H "x-user-id: $CUSTOMER_ID" \
  -H "Content-Type: application/json" \
  -d "{\"paymentRef\":\"$PAYREF_SHIP\",\"paidAmountCents\":$PAID_AMOUNT_CENTS}" \
  "$BASE/orders/$SHIPPING_ID/mark-paid"
echo
echo

echo "== shipping 发货 =="
curl -sS -X POST \
  -H "x-role: STORE" \
  -H "Content-Type: application/json" \
  -d '{"courierCompany":"SF Express","trackingNumber":"SF123456789CN"}' \
  "$BASE/orders/$SHIPPING_ID/ship"
echo
echo

echo "== shipping 妥投 =="
curl -sS -X POST \
  -H "x-role: STORE" \
  "$BASE/orders/$SHIPPING_ID/deliver"
echo
echo

echo "== shipping 最终状态 =="
curl -sS \
  -H "x-role: CUSTOMER" \
  -H "x-user-id: $CUSTOMER_ID" \
  "$BASE/orders/$SHIPPING_ID"
echo
echo

echo "== shipping 状态日志 =="
curl -sS \
  -H "x-role: STORE" \
  "$BASE/orders/$SHIPPING_ID/status-logs"
echo
echo
