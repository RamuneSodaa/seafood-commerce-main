# WeChat miniapp payment integration issues
_Exported on 5/16/2026 at 11:47:40 GMT+8 from Cursor (3.2.11)_

---

**User**

You are taking over an ongoing **WeChat miniapp local integration / acceptance** session for a monorepo project on the user's Mac.

Your role is:

* technical integration coach
* smallest-blocker investigator
* repo-local / terminal-first debugger

Do **not** broaden scope.
Do **not** refactor widely.
Do **not** start new feature phases.
Stay in:

* **integration validation mode**
* **smallest-blocker mode**

## Repo / local environment

Working repo path:
`/Users/lishaotian/Desktop/seafood-commerce-main`

Miniapp:

* Taro miniapp
* WeChat DevTools currently opens:
  `/Users/lishaotian/Desktop/seafood-commerce-main/apps/storefront-miniapp/dist`

Backend:

* Nest API
* local backend base URL:
  `http://127.0.0.1:3000`

Cloudflare tunnel currently used for public callback reachability:
`https://examples-charlie-visual-usc.trycloudflare.com`

Current payment callback URL wired locally:
`https://examples-charlie-visual-usc.trycloudflare.com/orders/miniapp-payment-callback`

Important:
The user already has active local env vars set in the backend-start shell, including miniapp auth and WeChat Pay-related secrets/certs.
Do **not** ask the user to paste secrets into chat again.
Assume env wiring exists in the active terminal unless proven otherwise.

## What has already been validated / fixed

### Earlier miniapp runtime / build blockers

These were already crossed:

1. raw `process.env.TARO_APP_*` leaked into the miniapp bundle and caused runtime failure (`process is not defined`)
2. fixed via compile-time injection in miniapp config
3. standalone miniapp type/build cleanup was already done
4. `npm run build:weapp` succeeds

Miniapp pages already open:

* `pages/products/index`
* `pages/orders/index`
* `pages/customer-login/index`

### Auth flow

Real login route confirmed:

* backend route is `POST /auth/exchange-real`
* not `/api/auth/exchange-real`

Earlier stale-process / route / env blockers were already crossed:

* 404 on `/auth/exchange-real` due to stale backend process
* `WECHAT_MINIAPP_APP_ID is not configured`
* `invalid appid`
* etc.

Current status:

* login flow: **PASS**

### Protected page auth

Orders protected page auth / redirect path was validated and then passed.

Current status:

* protected orders page: **PASS**

### Checkout blockers already fixed

There were two important checkout-phase blockers already handled:

1. `GET /customer/addresses/authenticated` returned 500 because Prisma table `CustomerAddress` did not exist locally (`P2021`)

   * local DB schema was synced
   * checkout page could open after that

2. `POST /orders/quote-preview` returned 400:

   * error: `Some SKUs are not available in selected store`
   * root cause: checkout surfaced stores that did not actually have enabled availability + positive inventory for the selected SKU
   * a durable repo-local fix was already applied:

     * storefront stores API now supports `skuId`
     * checkout store list is filtered by selected SKU
     * small guard added for bad/empty quote-preview handling
   * miniapp bundle rebuilt successfully after that

Current status:

* checkout page open: **PASS**
* quote preview: **PASS**

### Order creation / order detail

Order creation succeeded.
A pending-payment order was created and visible.
Order detail page opens.

Current status:

* order creation: **PASS**
* order detail status refresh / detail open: effectively working enough to proceed

### Tourist mode / AppID association confusion

There was a separate WeChat DevTools issue:

* DevTools had been opened in tourist mode before
* console showed `游客模式` / `无 AppID 关联`
* trying to change AppID inside that tourist project failed with `Change AppID failed touristappid`

That has now been corrected:

* DevTools is **no longer in tourist mode**
* real AppID is being used
* merchant-platform AppID association was completed:

  * AppID: `wx0ad267108804ad22`
  * associated status in merchant platform: `已关联`

So:

* this is **not** a tourist-mode blocker anymore
* this is **not** an AppID-binding blocker anymore

## Payment callback / tunnel status

We confirmed the backend callback route exists by source search:

* `apps/api/src/modules/orders/orders.controller.ts`
  contains:
  `@Post('miniapp-payment-callback')`

Repo search also showed test/example notify URL shape:

* `https://example.com/orders/miniapp-payment-callback`

Public tunnel was created:

* `https://examples-charlie-visual-usc.trycloudflare.com`

Manual callback reachability probe:

* `curl -i -X POST https://examples-charlie-visual-usc.trycloudflare.com/orders/miniapp-payment-callback -H 'Content-Type: application/json' -d '{}'`
* returned backend 400 validation:

  * message included `provider should not be empty`

This is important:

* callback URL reachability is working
* Cloudflare tunnel reaches the local backend
* current issue is **not** a notify_url reachability issue

## WeChat Pay / merchant-side facts already collected

Merchant account facts:

* merchant ID: `1742638416`
* merchant type shown in merchant platform: `特约商户`
* AppID associated in merchant platform:
  `wx0ad267108804ad22`
* WeChat Pay public key ID exists:
  `PUB_KEY_ID_0117426384162026041500181886004800`
* merchant certificate / private key files were obtained locally
* platform public key PEM file was obtained locally
* APIv2 / APIv3 keys were also configured on merchant side

Local cert file paths:

* merchant private key:
  `/Users/lishaotian/Desktop/wechat info/Certificate/apiclient_key.pem`
* platform public key:
  `/Users/lishaotian/Desktop/wechat info/pub_key.pem`

Do not ask for secret contents in chat.

## Current blocker

Current failing request:
`POST /orders/:id/create-miniapp-payment`

Observed result:

* local response status: `502 Bad Gateway`

Current UI error text:
`Wechat miniapp payment create failed: 商户号该产品权限未开通，请前往商户平台>产品中心检查后重试`

This failure persists even after:

* leaving tourist mode
* using real AppID
* completing AppID association
* wiring certs / merchant ID / notify_url / platform public key
* confirming callback reachability

So the remaining blocker is now likely one of:

1. **merchant product permission not enabled**
2. **special-merchant / service-provider ownership mismatch**
3. **backend is using normal-merchant miniapp pay flow while this merchant should actually be handled as a partner / special-merchant flow**

## What I need you to do now

Stay narrow.
Do not refactor.
Do not implement broad changes.
Do not broaden beyond payment-launch blocker.

### Task 1

Inspect the exact backend path for:

* `create-miniapp-payment`
* how the upstream WeChat Pay request is built
* where upstream failure is wrapped into local 502

Likely files to inspect first:

* `apps/api/src/modules/orders/orders.controller.ts`
* `apps/api/src/modules/orders/order-workflow.service.ts`
* `apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts`
* any related DTO / client / mapper files

### Task 2

Determine whether the upstream request is being built as:

* **normal merchant miniapp pay flow**

  * e.g. `mchid`, `appid`, `openid`, etc.
    or
* **partner / service-provider flow**

  * e.g. `sp_mchid`, `sub_mchid`, `sp_appid`, `sub_appid`, etc.

This matters because the merchant account type visible in merchant platform is:

* `特约商户`

### Task 3

Find the exact upstream raw error body / code / message that corresponds to the current local `502`.
Do not stop at the local wrapped message.
I want the actual upstream response details from WeChat Pay if available in code/logs.

### Task 4

Tell me which of these is the best-supported current diagnosis:

* product permission truly not enabled
* merchant role / ownership mismatch
* integration mode mismatch (normal merchant vs partner/special merchant)
* something else merchant-side

### Task 5

Give me the **smallest next action only**:

* platform-side action if this is truly a permission / service-provider issue
* code-side action only if you can prove the current implementation is using the wrong pay mode

### Task 6

Do not modify code yet unless there is a proven minimal fix and you clearly explain why it is necessary.

## Expected output format

Please answer with:

1. **Current diagnosis**
2. **Evidence from source files**
3. **Exact file paths involved**
4. **Upstream payload shape being used**
5. **Where 502 wrapping happens**
6. **Most likely root cause**
7. **Smallest next action**

Be explicit and grounded.
Do not give generic WeChat Pay advice.
Use the current repo state and the facts above.


---

**Cursor**

I’m narrowing in on the payment-launch path now: first I’ll trace `create-miniapp-payment` through the backend source, then I’ll check the active terminal/log output to see whether the raw WeChat Pay error body is already being emitted before the local `502`.

The controller/service path is confirmed; next I’m checking whether the WeChat client preserves the upstream `code` anywhere and whether recent backend terminal output captured the full upstream body or only the wrapped message.

I’ve confirmed the request body is hard-coded to the direct JSAPI shape in both source and test. I’m reading the backend terminal that mapped the route to see whether the actual WeChat response body or status code was printed during the failing call.

So far, the backend route is live but the running terminal hasn’t logged request-time details. I’m doing one more pass across the repo and terminal state for the exact Chinese upstream message or WeChat error code, because the client currently only preserves `message` unless something else logged the full body.

I’ve reached the likely fork point: the codebase appears to only know the direct-merchant JSAPI contract. I’m running one precise search for partner-mode identifiers/endpoints so I can state cleanly whether a service-provider path exists anywhere at all.

## 1. Current diagnosis

The backend is building the payment request as a **direct / normal-merchant JSAPI miniapp payment**, not a **partner / service-provider** payment.

Given your confirmed merchant-platform identity is `特约商户`, the best-supported diagnosis is: **integration mode mismatch is the leading cause**, and the displayed `产品权限未开通` message is likely the upstream symptom of sending a direct-merchant JSAPI request for an account that should be handled under partner mode or under the owning service-provider relationship.

## 2. Evidence from source files

The controller simply delegates `POST /orders/:id/create-miniapp-payment` into the order workflow:

```106:113:apps/api/src/modules/orders/orders.controller.ts
  @Post(':id/create-miniapp-payment')
  @UseGuards(CustomerAuthArtifactGuard)
  createMiniappPayment(@Param('id') id: string, @Req() req: { authenticatedCustomer: VerifiedCustomerAuthIdentity }) {
    return this.workflow.createMiniappPayment(id, {
      role: req.authenticatedCustomer.role,
      userId: req.authenticatedCustomer.userId
    });
  }
```

The workflow extracts a plain WeChat `openId` from the authenticated customer and calls the WeChat payment client with only `orderNo`, `totalAmountCents`, and `openId`:

```241:253:apps/api/src/modules/orders/order-workflow.service.ts
  async createMiniappPayment(orderId: string, actor: RequestActor = ADMIN_ACTOR) {
    const order = await this.getOrder(orderId, actor);

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Miniapp payment creation only allowed from PENDING_PAYMENT');
    }

    const openId = this.getWechatOpenIdFromCustomerUserId(order.customerId);
    const paymentCreation = await this.wechatMiniappPaymentCreateClient.createMiniappPayment({
      orderNo: order.orderNo,
      totalAmountCents: order.totalAmountCents,
      openId
    });
```

The actual WeChat request is hard-coded to the **direct JSAPI endpoint** and body shape:

```68:95:apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts
  private readonly createUrl = 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi';
  private readonly createPathname = '/v3/pay/transactions/jsapi';

  async createMiniappPayment(input: {
    orderNo: string;
    totalAmountCents: number;
    openId: string;
  }): Promise<{ launchParams: WechatMiniappLaunchParams }> {
    const appId = readRequiredWechatPaymentConfig('WECHAT_MINIAPP_APP_ID');
    const merchantId = readRequiredWechatPaymentConfig('WECHAT_PAY_MERCHANT_ID');
    const merchantSerial = readRequiredWechatPaymentConfig('WECHAT_PAY_MERCHANT_SERIAL');
    const merchantPrivateKeyPem = readRequiredWechatPaymentConfig('WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM');
    const notifyUrl = readRequiredWechatPaymentConfig('WECHAT_PAY_NOTIFY_URL');

    const requestBody = JSON.stringify({
      appid: appId,
      mchid: merchantId,
      description: input.orderNo,
      out_trade_no: input.orderNo,
      notify_url: notifyUrl,
      amount: {
        total: input.totalAmountCents,
        currency: 'CNY'
      },
      payer: {
        openid: input.openId
      }
    });
```

I also searched the API code for partner-mode identifiers and found **no matches** for `partner/transactions/jsapi`, `sp_mchid`, `sub_mchid`, `sp_appid`, or `sub_appid`.

The test file also asserts this same direct-merchant payload shape in `apps/api/test/wechat-miniapp-payment-create.client.spec.ts`.

## 3. Exact file paths involved

- `apps/api/src/modules/orders/orders.controller.ts`
- `apps/api/src/modules/orders/order-workflow.service.ts`
- `apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts`
- `apps/api/test/wechat-miniapp-payment-create.client.spec.ts`

## 4. Upstream payload shape being used

The current upstream call is:

- Endpoint: `POST https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi`
- Payload shape:
```json
{
  "appid": "<miniapp appid>",
  "mchid": "<merchant id>",
  "description": "<orderNo>",
  "out_trade_no": "<orderNo>",
  "notify_url": "<callback url>",
  "amount": {
    "total": <cents>,
    "currency": "CNY"
  },
  "payer": {
    "openid": "<openid>"
  }
}
```

That is the **normal merchant JSAPI** shape.

It is **not** using partner/service-provider fields such as:

- `sp_mchid`
- `sub_mchid`
- `sp_appid`
- `sub_appid`
- `payer.sub_openid`

## 5. Where 502 wrapping happens

The `502` is thrown inside `apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts`:

```125:130:apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts
    if (!response.ok) {
      if (isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()) {
        throw new BadGatewayException(`Wechat miniapp payment create failed: ${payload.message.trim()}`);
      }

      throw new BadGatewayException(`Wechat miniapp payment create failed with status ${response.status}`);
    }
```

Important detail: this wrapper only preserves `payload.message` if present. It does **not** surface `payload.code`, and if `message` exists it also hides the upstream HTTP status from the final error text.

## 6. Most likely root cause

**Most likely root cause: integration mode mismatch, specifically direct-merchant JSAPI is being used against a merchant account that appears to be a `特约商户`.**

Why this is the best-supported diagnosis instead of a pure “product not enabled” diagnosis:

- The repo has **only** a direct-merchant JSAPI implementation.
- There is **no** partner-mode endpoint or payload support anywhere in the API code.
- Your merchant-platform fact pattern says the merchant is `特约商户`, which strongly points to sub-merchant / service-provider ownership semantics.
- The observed Chinese message is consistent with an upstream merchant-side rejection, but the repo evidence says the most suspicious mismatch is **how** the merchant is being addressed, not callback wiring or miniapp login.

On the raw upstream details:

- The only upstream detail recoverable from the current repo/log state is the **message text** you already saw:
  `商户号该产品权限未开通，请前往商户平台>产品中心检查后重试`
- The current code does parse the JSON body, but it does **not** log or return `payload.code`.
- The currently available backend terminal output only shows startup and route mapping; it does **not** contain a request-time dump of the WeChat response body.

So the exact upstream `code` is **not available from current code/logs**.

## 7. Smallest next action

Have the merchant-side operator verify, in the **owning service-provider / partner context**, whether merchant `1742638416` is a **sub-merchant (`特约商户`) that must use partner JSAPI** and whether Mini Program payment is enabled there; if that answer is yes, this repo’s current direct-merchant payment mode is the wrong integration mode and that is the minimal proof needed before any code change.

---

**User**

You are taking over an ongoing WeChat miniapp local integration / acceptance session.

Stay in:

* integration validation mode
* smallest-blocker mode

Do not broaden scope.
Do not refactor widely.
Do not start new feature phases.
Do not ask for secrets in chat again.

## Current repo / environment

Repo path:
`/Users/lishaotian/Desktop/seafood-commerce-main`

Miniapp dist currently used in WeChat DevTools:
`/Users/lishaotian/Desktop/seafood-commerce-main/apps/storefront-miniapp/dist`

Backend:

* Nest API
* local base URL: `http://127.0.0.1:3000`

Cloudflare tunnel currently in use:
`https://examples-charlie-visual-usc.trycloudflare.com`

Current notify URL wired locally:
`https://examples-charlie-visual-usc.trycloudflare.com/orders/miniapp-payment-callback`

## What has already been solved

These are already passed:

* login flow
* protected orders page
* checkout page open
* address endpoint issue
* quote-preview blocker
* order creation
* order detail open

Important earlier blockers that are already resolved:

* stale backend process / wrong route visibility
* miniapp runtime `process is not defined`
* auth exchange route/env issues
* checkout store-SKU mismatch
* tourist-mode DevTools confusion
* AppID association confusion

## Very important current facts

### WeChat DevTools / AppID state

* DevTools is no longer in tourist mode
* real AppID is being used
* merchant-platform AppID association has already been completed
* AppID: `wx0ad267108804ad22`

So this is **not** a tourist-mode blocker anymore.
This is **not** an AppID-binding blocker anymore.

### Merchant-side facts

* merchant ID: `1742638416`
* merchant type shown in merchant platform: `特约商户`
* merchant private key file exists locally:
  `/Users/lishaotian/Desktop/wechat info/Certificate/apiclient_key.pem`
* platform public key file exists locally:
  `/Users/lishaotian/Desktop/wechat info/pub_key.pem`
* merchant certificate serial is already known locally
* platform public key ID is already known locally
* callback notify URL is already wired through Cloudflare tunnel

### Callback reachability

We already proved callback reachability:

* backend has `POST /orders/miniapp-payment-callback`
* public tunnel request to that callback reached the backend and returned backend validation 400
* this means notify_url reachability is already working
* this is **not** a callback/tunnel problem anymore

## Current failing request

Current failing request:
`POST /orders/:id/create-miniapp-payment`

Observed result:

* local response status: `502`
* UI error text:
  `Wechat miniapp payment create failed: 商户号该产品权限未开通，请前往商户平台>产品中心检查后重试`

This failure still happens after:

* leaving tourist mode
* using real AppID
* completing AppID association
* wiring local merchant cert / private key / platform public key / notify_url

## Prior diagnosis already established from source

You previously established the following from source:

* the backend builds payment as **direct / normal-merchant JSAPI miniapp payment**
* it uses:
  `POST https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi`
* payload shape is:

  * `appid`
  * `mchid`
  * `notify_url`
  * `payer.openid`
* there is no partner/service-provider payload support found
* no `sp_mchid`
* no `sub_mchid`
* no `sp_appid`
* no `sub_appid`
* no partner-mode endpoint usage

You also identified the relevant files:

* `apps/api/src/modules/orders/orders.controller.ts`
* `apps/api/src/modules/orders/order-workflow.service.ts`
* `apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts`
* `apps/api/test/wechat-miniapp-payment-create.client.spec.ts`

You also identified where local 502 wrapping happens:

* upstream error message is wrapped into local `BadGatewayException`

## New instruction based on clarified business fact

This is now confirmed:
**we are intentionally using a 特约商户 / special-merchant flow**

So I want you to proceed from that assumption.

## What I need you to do now

### Task 1

Re-evaluate the payment-launch blocker under the assumption that the merchant is supposed to use:

* partner / service-provider mode
* not direct normal-merchant mode

### Task 2

Inspect the current backend implementation and tell me exactly what needs to change, minimally, to support the correct partner / special-merchant miniapp payment launch path.

I want specifics:

* which upstream endpoint should be used instead
* which payload fields need to change
* which identity fields should map to:

  * service-provider merchant
  * sub-merchant
  * appid/sub_appid
  * payer openid vs sub_openid if relevant
* what new config/env vars are minimally required

### Task 3

Give me a minimal implementation plan:

* exact files to edit
* what code path to replace or branch
* whether to preserve current direct-merchant path behind a mode switch or replace it outright for this project
* how to surface upstream raw error code/body better during validation

### Task 4

Then, if the diagnosis is strong enough, implement the **smallest correct repo-local code change** needed to make payment launch follow the special-merchant / partner path for this project.

Do not do broad refactors.
Do not redesign payments.
Do not touch unrelated modules.

### Task 5

After implementing, tell me:

1. exactly what files changed
2. exactly what env/config is newly required
3. exactly what command(s) I need to rerun
4. exact manual re-test steps in WeChat DevTools
5. what result should prove the fix worked

## Important guardrails

* do not revisit login / checkout / quote-preview
* do not broaden to callback-completion yet
* focus only on `create-miniapp-payment`
* keep the change minimal and grounded in the current repo

## Expected output format

Please answer with:

1. confirmed diagnosis
2. exact code mismatch
3. exact files to change
4. minimal implementation plan
5. applied changes (if implemented)
6. rerun commands
7. manual re-test steps
8. expected success criteria


---

**Cursor**

I’m proceeding under the confirmed `特约商户` assumption now. First I’m verifying the exact partner JSAPI endpoint and field names against live docs, then I’ll patch only the current miniapp payment client and its immediate call path.

I’ve got the exact partner API contract. I’m patching only the miniapp payment client plus its focused test so the backend can switch to partner-mode JSAPI with `sub_appid/sub_openid`, while also surfacing upstream `status/code/message` instead of only the wrapped Chinese message.

The code change is in place. I’m running a focused validation now: a targeted Jest run for the payment client and a lint pass on just the files I touched, so we stay on the payment-launch blocker only.

The focused test pass succeeded and there are no new lint errors in the touched files. I’m pulling the final line references now so I can give you a grounded handoff with the exact envs, rerun commands, and the proof point to look for in DevTools.

1. **Confirmed diagnosis**

The blocker was a real code mismatch: this repo was still launching miniapp payment as **direct merchant JSAPI**, but your clarified business fact is that this project should use **partner / service-provider mode for a `特约商户`**.

I implemented the smallest repo-local fix by adding a **payment mode switch** and wiring the miniapp payment client to use the **partner JSAPI endpoint** when `WECHAT_PAY_MODE=partner`.

2. **Exact code mismatch**

Before the change, the backend always called the direct endpoint and direct payload:

```82:95:apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts
    const requestBody = JSON.stringify({
      appid: appId,
      mchid: merchantId,
      description: input.orderNo,
      out_trade_no: input.orderNo,
      notify_url: notifyUrl,
      amount: {
        total: input.totalAmountCents,
        currency: 'CNY'
      },
      payer: {
        openid: input.openId
      }
    });
```

That was wrong for your confirmed `特约商户` flow.

Now the client branches to partner mode and uses:

- endpoint: `POST /v3/pay/partner/transactions/jsapi`
- `sp_mchid` = service-provider merchant
- `sub_mchid` = special/sub-merchant
- `sub_appid` = current miniapp AppID
- `payer.sub_openid` = current authenticated WeChat openid from that miniapp

```85:108:apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts
    const requestTarget =
      paymentMode === 'partner'
        ? {
            createUrl: 'https://api.mch.weixin.qq.com/v3/pay/partner/transactions/jsapi',
            createPathname: '/v3/pay/partner/transactions/jsapi',
            authorizationMerchantId: readRequiredWechatPaymentConfig('WECHAT_PAY_SP_MERCHANT_ID'),
            authorizationMerchantSerial: readRequiredWechatPaymentConfig('WECHAT_PAY_SP_MERCHANT_SERIAL'),
            authorizationPrivateKeyPem: readRequiredWechatPaymentConfig('WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM'),
            requestAppId: miniappAppId,
            requestBody: JSON.stringify({
              sp_mchid: readRequiredWechatPaymentConfig('WECHAT_PAY_SP_MERCHANT_ID'),
              sub_mchid: readRequiredWechatPaymentConfig('WECHAT_PAY_SUB_MERCHANT_ID'),
              sub_appid: miniappAppId,
              // ...
              payer: {
                sub_openid: input.openId
              }
            })
          }
```

Identity mapping now is:

- service-provider merchant: `WECHAT_PAY_SP_MERCHANT_ID` -> `sp_mchid`
- sub/special merchant: `WECHAT_PAY_SUB_MERCHANT_ID` -> `sub_mchid`
- app id in this project: `WECHAT_MINIAPP_APP_ID` -> `sub_appid`
- payer identity in this project: customer `openId` -> `payer.sub_openid`

I did **not** use `sp_appid` / `sp_openid`, because your payer is inside the sub-merchant miniapp, not a service-provider-hosted miniapp.

3. **Exact files to change**

Changed:

- `apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts`
- `apps/api/test/wechat-miniapp-payment-create.client.spec.ts`

Not changed:

- `apps/api/src/modules/orders/orders.controller.ts`
- `apps/api/src/modules/orders/order-workflow.service.ts`

Those already passed the right `orderNo`, amount, and authenticated `openId`; only the upstream WeChat Pay client needed the mode correction.

4. **Minimal implementation plan**

Plan I followed:

- Keep the existing direct path intact behind a small mode switch.
- Add `WECHAT_PAY_MODE` with `direct | partner`.
- In partner mode:
  - call `/v3/pay/partner/transactions/jsapi`
  - sign the request with **service-provider** credentials
  - send `sub_appid` and `payer.sub_openid`
- Improve validation-time errors so upstream `status`, `code`, and `message` are surfaced instead of only the wrapped message.

I preserved the direct path rather than replacing it outright, because that was the smallest safe change and avoids breaking existing local direct-mode behavior or tests.

5. **Applied changes (implemented)**

Applied:

- Added `WECHAT_PAY_MODE` parsing with `partner` support.
- Added partner request shape and endpoint selection.
- Added new partner-mode env reads:
  - `WECHAT_PAY_SP_MERCHANT_ID`
  - `WECHAT_PAY_SUB_MERCHANT_ID`
  - `WECHAT_PAY_SP_MERCHANT_SERIAL`
  - `WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM`
- Kept `WECHAT_MINIAPP_APP_ID` as the miniapp appid and mapped it to `sub_appid`.
- Kept `WECHAT_PAY_NOTIFY_URL` unchanged.
- Improved upstream error surfacing:

```161:174:apps/api/src/modules/orders/wechat-miniapp-payment-create.client.ts
    if (!response.ok) {
      const responseDetails = [] as string[];
      if (isRecord(payload) && typeof payload.code === 'string' && payload.code.trim()) {
        responseDetails.push(`code=${payload.code.trim()}`);
      }
      if (isRecord(payload) && typeof payload.message === 'string' && payload.message.trim()) {
        responseDetails.push(`message=${payload.message.trim()}`);
      } else if (responseText.trim()) {
        responseDetails.push(`body=${responseText.trim()}`);
      }

      const detailSuffix = responseDetails.length > 0 ? `; ${responseDetails.join('; ')}` : '';

      throw new BadGatewayException(`Wechat miniapp payment create failed with upstream status ${response.status}${detailSuffix}`);
    }
```

Validation:

- `npm run test -w @seafood/api -- wechat-miniapp-payment-create.client.spec.ts` passed
- no linter errors in touched files

6. **Rerun commands**

You only need to restart the backend with partner-mode env set. No miniapp rebuild is needed for this backend-only change.

In your backend-start shell, set:

```bash
export WECHAT_PAY_MODE='partner'
export WECHAT_PAY_SUB_MERCHANT_ID='1742638416'
export WECHAT_PAY_SP_MERCHANT_ID='<service-provider-mchid>'
export WECHAT_PAY_SP_MERCHANT_SERIAL='<service-provider-cert-serial>'
export WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM="$(cat "/path/to/service-provider-apiclient_key.pem")"
npm run start -w @seafood/api
```

Still required and already existing from your session:

- `WECHAT_MINIAPP_APP_ID='wx0ad267108804ad22'`
- `WECHAT_PAY_NOTIFY_URL='https://examples-charlie-visual-usc.trycloudflare.com/orders/miniapp-payment-callback'`

Newly required for partner mode:

- `WECHAT_PAY_MODE`
- `WECHAT_PAY_SUB_MERCHANT_ID`
- `WECHAT_PAY_SP_MERCHANT_ID`
- `WECHAT_PAY_SP_MERCHANT_SERIAL`
- `WECHAT_PAY_SP_MERCHANT_PRIVATE_KEY_PEM`

7. **Manual re-test steps**

1. Restart the API with the partner env above.
2. In WeChat DevTools, keep using the existing miniapp dist.
3. Log in as before.
4. Open the already-created pending-payment order detail, or create a fresh pending-payment order if needed.
5. Trigger the same action that calls `POST /orders/:id/create-miniapp-payment`.
6. Watch the result:
   - if successful, the backend should return payment launch params and the miniapp should proceed to `wx.requestPayment`
   - if still rejected upstream, the UI/backend error text should now include the upstream status and code, not just the message

8. **Expected success criteria**

Proof the fix worked is:

- `POST /orders/:id/create-miniapp-payment` no longer returns the old direct-mode-style `502` with only wrapped text
- instead it returns `200` with `launchParams` containing:
  - `timeStamp`
  - `nonceStr`
  - `package`
  - `signType`
  - `paySign`
- WeChat DevTools proceeds to the payment sheet / payment invocation flow

If it still fails after this change, the next failure should be much more actionable because it will now expose upstream details like:

- `upstream status`
- `code=...`
- `message=...`

That would confirm the code path is corrected and the remaining blocker is purely merchant-side configuration under the service-provider relationship.

