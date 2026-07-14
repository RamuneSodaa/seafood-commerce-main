# Phase 3 Real Identity Entry Boundary Ready

## 1. Current identity state

The current web and miniapp customer identity path still mainly relies on demo / profile / placeholder identity behavior. Real WeChat login, `openid` / `unionid`, and real token / session integration are not implemented yet.

## 2. Best future write-in point for real identity

The future real identity should be written into the existing dedicated real-identity storage/provider layer, instead of being scattered across page components or request callers. This keeps the current identity source structure intact and makes later replacement safer.

## 3. Recommended provider read priority

The provider read priority should stay explicit and stable:
- profile / env override
- future real identity
- placeholder identity
- demo fallback

This boundary should not be inverted or collapsed when real identity is introduced.

## 4. Which flows will depend on real identity later

The most direct future dependencies are:
- customer order creation
- customer order list / detail access
- customer address ownership
- coupon eligibility / pricing ownership
- payment identity binding

These flows should read identity only through the provider layer.

## 5. Explicitly out of scope now

This stage does not implement:
- full WeChat login
- `openid` / `unionid` integration
- full token / session integration
- user center / account system
- permission redesign

## 6. Next smallest implementation step

The next smallest step is to define one concrete real-identity write path into the existing provider/storage structure, so that a future successful login callback can write real customer identity without changing the current demo / placeholder / profile architecture.
