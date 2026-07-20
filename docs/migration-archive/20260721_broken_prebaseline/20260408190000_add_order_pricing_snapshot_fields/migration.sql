ALTER TABLE "Order"
ADD COLUMN "subtotalAmountCents" INTEGER,
ADD COLUMN "discountAmountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "appliedCouponCode" TEXT;
