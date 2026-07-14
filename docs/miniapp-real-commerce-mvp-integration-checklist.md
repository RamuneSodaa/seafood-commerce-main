## Miniapp Real Commerce MVP Integration Checklist

### 1. Scope

- Use this checklist only for the current miniapp real customer commerce MVP path.
- Validate on a real device or real miniapp runtime with the real backend environment intended for testing.
- Do not treat this checklist as refund, reconciliation, admin, or broader platform validation.

### 2. Environment / Config Prerequisites

- Miniapp build can be produced successfully with `npm run build:weapp` in `apps/storefront-miniapp`.
- The miniapp backend API is reachable from the real device / miniapp runtime.
- Real miniapp auth exchange is configured and available.
- Real miniapp payment-create config is present on the backend.
- Real payment callback endpoint is reachable by the payment provider.
- The current environment has at least one salable product, one valid store, and usable inventory.
- The payment environment is configured so a real miniapp payment launch can be attempted.
- The tester has a real customer device/session capable of completing the login and payment flow.

### 3. Customer Login Entry

- Open the normal customer miniapp path and enter through `pages/customer-login/index`.
- Trigger real customer login.
- Confirm login completes successfully and returns to the normal customer path.
- Confirm the customer can proceed without using any dev-only page.

Pass:
- Login succeeds and the miniapp returns to the expected customer path.

Fail:
- Login cannot complete, returns raw auth errors, or depends on a dev-only page.

### 4. Protected-Page Redirect

- Clear the stored customer auth state on the test device if needed.
- Attempt to open a protected customer page such as orders, order detail, or protected checkout.
- Confirm the miniapp redirects to the normal customer login entry instead of surfacing a raw missing-auth error.
- Complete login and confirm the miniapp returns to the originally attempted protected path.

Pass:
- Missing auth leads to normal login redirection and then returns to the protected flow.

Fail:
- A raw missing-artifact error is shown, or the return path is lost after login.

### 5. Checkout

- From the normal product flow, open product detail and enter checkout.
- Confirm the checkout page loads product, store, and fulfillment information correctly.
- If shipping is used, confirm the address path behaves correctly for the authenticated customer flow.
- Confirm checkout remains within the normal non-dev customer path.

Pass:
- Checkout loads normally and is usable for the authenticated customer.

Fail:
- Checkout cannot load, loses auth unexpectedly, or requires a dev-only workaround.

### 6. Order Creation

- Submit one real authenticated order from checkout.
- Confirm order creation succeeds and redirects or lands naturally in the customer order path.
- Confirm the new order appears in the authenticated order list.

Pass:
- A new order is created successfully and is visible to the same authenticated customer.

Fail:
- Order creation fails unexpectedly, or the created order is not visible in the normal customer order flow.

### 7. Miniapp Payment Launch

- Open the created order in order detail while it is still eligible for payment.
- Trigger the miniapp payment action.
- Confirm the backend payment-create path succeeds and the miniapp launches the real payment UI.
- If the user cancels, confirm the miniapp reports cancellation honestly.
- If launch fails, confirm the miniapp reports launch failure honestly.

Pass:
- The real miniapp payment UI launches, or cancellation/failure is surfaced honestly.

Fail:
- The miniapp claims payment completion before callback completion, or cannot launch payment when backend creation succeeds.

### 8. Callback Completion

- Complete the real payment through the provider flow.
- Confirm the backend callback path completes payment into the existing order completion path.
- Confirm the callback route behaves as provider-safe acknowledgment and does not expose internal business payload as the provider response contract.

Pass:
- Payment callback completes successfully and the order advances out of the unpaid state.

Fail:
- Callback completion does not update the order correctly, or provider-facing acknowledgment behavior is inconsistent.

### 9. Order-Detail Status Refresh

- After successful payment launch, stay on order detail and observe the immediate refresh plus bounded polling behavior.
- Confirm the page stops polling once order status leaves `PENDING_PAYMENT`.
- If backend confirmation is delayed, confirm the fallback message is honest and does not falsely report failure or completion.

Pass:
- Order detail refreshes correctly after payment launch and reflects backend completion when available.

Fail:
- The page gets stuck with misleading status messaging, or does not reflect callback completion reasonably.

### 10. Pass / Fail Notes

- Test date:
- Environment:
- Miniapp build identifier:
- Backend base URL:
- Payment environment:
- Tester / device:
- Login result:
- Protected redirect result:
- Checkout result:
- Order creation result:
- Payment launch result:
- Callback completion result:
- Order-detail refresh result:
- Overall result: PASS / FAIL
- Notes:
