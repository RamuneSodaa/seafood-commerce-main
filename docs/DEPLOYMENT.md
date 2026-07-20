# Production Deployment Contract

## API process

Build:

```bash
npm run build -w @seafood/api
```

Start:

```bash
npm run start:prod -w @seafood/api
```

The API binds to `HOST` (default `0.0.0.0`) and `PORT`
(default `3000` outside managed hosting).

Health endpoint:

```text
GET /health
```

## Required production configuration

Database:

- `DATABASE_URL`

Runtime:

- `NODE_ENV=production`
- `ALLOWED_ORIGINS`
- `CUSTOMER_AUTH_ARTIFACT_SECRET`
- `CUSTOMER_AUTH_ARTIFACT_TTL_SECONDS` (recommended: `604800`)

WeChat Mini Program:

- `WECHAT_MINIAPP_APP_ID`
- `WECHAT_MINIAPP_APP_SECRET`

WeChat Pay direct-merchant mode:

- `WECHAT_PAY_MODE=direct`
- `WECHAT_PAY_MERCHANT_ID`
- `WECHAT_PAY_MERCHANT_SERIAL`
- `WECHAT_PAY_MERCHANT_PRIVATE_KEY_PEM`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_PUBLIC_KEY_PEM` or `WECHAT_PAY_PUBLIC_KEY_PATH`
- `WECHAT_PAY_PUBLIC_KEY_ID`
- `WECHAT_PAY_NOTIFY_URL`

## Security rules

- Never commit secret values, private keys, `.p12` files, or production
  database credentials.
- Production deploy must not run local seed scripts automatically.
- Database migration/seed is a separate explicit release gate.
- `WECHAT_PAY_NOTIFY_URL` must point to the deployed callback endpoint:

  `/orders/miniapp-payment-callback`

- Real payment remains blocked until HTTPS deployment, database release
  gate, merchant/AppID binding verification, and live prepay connectivity
  checks have passed.
