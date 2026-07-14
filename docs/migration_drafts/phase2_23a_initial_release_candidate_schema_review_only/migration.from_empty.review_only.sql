-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('STORE_PICKUP', 'SHIPPING');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID_PENDING_PREP', 'READY_FOR_PICKUP', 'COMPLETED', 'PAID_PENDING_SHIPMENT', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'AFTER_SALES');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'STORE_STAFF');

-- CreateEnum
CREATE TYPE "CouponDiscountType" AS ENUM ('AMOUNT_OFF', 'PERCENT_OFF');

-- CreateEnum
CREATE TYPE "CouponTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CouponScene" AS ENUM ('GENERAL', 'NEW_USER', 'REFERRAL_INVITER', 'REFERRAL_INVITEE', 'MANUAL');

-- CreateEnum
CREATE TYPE "UserCouponStatus" AS ENUM ('CLAIMED', 'LOCKED', 'USED', 'EXPIRED', 'VOID');

-- CreateEnum
CREATE TYPE "CouponGrantReason" AS ENUM ('NEW_USER', 'REFERRAL_REWARD', 'MANUAL', 'SEED');

-- CreateEnum
CREATE TYPE "CouponRedemptionAction" AS ENUM ('LOCK', 'USE', 'RELEASE', 'VOID');

-- CreateEnum
CREATE TYPE "MemberLevel" AS ENUM ('DEFAULT');

-- CreateEnum
CREATE TYPE "ReferralRelationStatus" AS ENUM ('BOUND', 'QUALIFIED', 'REWARDED', 'VOID');

-- CreateEnum
CREATE TYPE "ReferralRewardType" AS ENUM ('COUPON');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'GRANTED', 'VOID');

-- CreateEnum
CREATE TYPE "ReferralEventType" AS ENUM ('OPEN', 'LOGIN_BIND', 'FIRST_ORDER_PAID', 'REWARD_GRANTED');

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImageUrl" TEXT,
    "category" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "supportsPickup" BOOLEAN NOT NULL DEFAULT true,
    "supportsShipping" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSkuAvailability" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSkuAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "physicalStock" INTEGER NOT NULL,
    "availableStock" INTEGER NOT NULL,
    "reservedStock" INTEGER NOT NULL,
    "damagedStock" INTEGER NOT NULL DEFAULT 0,
    "safeStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "fulfillmentType" "FulfillmentType" NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "subtotalAmountCents" INTEGER,
    "discountAmountCents" INTEGER NOT NULL DEFAULT 0,
    "memberDiscountAmountCents" INTEGER NOT NULL DEFAULT 0,
    "couponDiscountAmountCents" INTEGER NOT NULL DEFAULT 0,
    "totalAmountCents" INTEGER NOT NULL,
    "appliedCouponCode" TEXT,
    "appliedUserCouponId" TEXT,
    "pickupDate" TIMESTAMP(3),
    "pickupTimeSlot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL DEFAULT 'AMOUNT_OFF',
    "thresholdAmountCents" INTEGER NOT NULL DEFAULT 0,
    "discountAmountCents" INTEGER,
    "discountPercent" INTEGER,
    "maxDiscountAmountCents" INTEGER,
    "totalLimit" INTEGER,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "stackGroup" TEXT NOT NULL DEFAULT 'GENERAL',
    "canStack" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "autoGrantOnNewUser" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "status" "CouponTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "scene" "CouponScene" NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouponTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCoupon" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "UserCouponStatus" NOT NULL DEFAULT 'CLAIMED',
    "lockedOrderId" TEXT,
    "usedOrderId" TEXT,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCouponApplication" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userCouponId" TEXT NOT NULL,
    "couponTemplateId" TEXT NOT NULL,
    "couponCodeSnapshot" TEXT NOT NULL,
    "couponNameSnapshot" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCouponApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponGrantLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userCouponId" TEXT,
    "reason" "CouponGrantReason" NOT NULL,
    "referrerCustomerId" TEXT,
    "referredCustomerId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponGrantLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemptionLog" (
    "id" TEXT NOT NULL,
    "userCouponId" TEXT NOT NULL,
    "orderId" TEXT,
    "action" "CouponRedemptionAction" NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemptionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "isMember" BOOLEAN NOT NULL DEFAULT true,
    "memberLevel" "MemberLevel" NOT NULL DEFAULT 'DEFAULT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkuMemberPrice" (
    "id" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "memberLevel" "MemberLevel" NOT NULL DEFAULT 'DEFAULT',
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkuMemberPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralRelation" (
    "id" TEXT NOT NULL,
    "referrerCustomerId" TEXT NOT NULL,
    "referredCustomerId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "status" "ReferralRelationStatus" NOT NULL DEFAULT 'BOUND',
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedOrderId" TEXT,
    "qualifiedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "receiverCustomerId" TEXT NOT NULL,
    "rewardType" "ReferralRewardType" NOT NULL DEFAULT 'COUPON',
    "userCouponId" TEXT,
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEvent" (
    "id" TEXT NOT NULL,
    "inviteCode" TEXT,
    "eventType" "ReferralEventType" NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "postalCode" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderShippingAddressSnapshot" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "postalCode" TEXT,

    CONSTRAINT "OrderShippingAddressSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courierCompany" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "pickupCode" TEXT NOT NULL,
    "pickedUpAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentRef" TEXT NOT NULL,
    "paidAmountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLog" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "orderId" TEXT,
    "storeId" TEXT,
    "skuId" TEXT,
    "action" TEXT NOT NULL,
    "deltaAvailable" INTEGER NOT NULL,
    "deltaReserved" INTEGER NOT NULL,
    "deltaPhysical" INTEGER NOT NULL,
    "oldAvailableStock" INTEGER,
    "newAvailableStock" INTEGER,
    "oldReservedStock" INTEGER,
    "newReservedStock" INTEGER,
    "oldPhysicalStock" INTEGER,
    "newPhysicalStock" INTEGER,
    "reason" TEXT,
    "note" TEXT,
    "operatorAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "action" TEXT,
    "reason" TEXT,
    "operatorAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'STORE_STAFF',
    "storeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_code_key" ON "Sku"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_customerId_key" ON "Cart"("customerId");

-- CreateIndex
CREATE INDEX "Cart_customerId_idx" ON "Cart"("customerId");

-- CreateIndex
CREATE INDEX "CartItem_skuId_idx" ON "CartItem"("skuId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_skuId_key" ON "CartItem"("cartId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSkuAvailability_storeId_skuId_key" ON "StoreSkuAvailability"("storeId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_storeId_skuId_key" ON "Inventory"("storeId", "skuId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "CouponTemplate_code_key" ON "CouponTemplate"("code");

-- CreateIndex
CREATE INDEX "CouponTemplate_status_scene_idx" ON "CouponTemplate"("status", "scene");

-- CreateIndex
CREATE INDEX "CouponTemplate_autoGrantOnNewUser_status_idx" ON "CouponTemplate"("autoGrantOnNewUser", "status");

-- CreateIndex
CREATE INDEX "UserCoupon_customerId_status_idx" ON "UserCoupon"("customerId", "status");

-- CreateIndex
CREATE INDEX "UserCoupon_templateId_status_idx" ON "UserCoupon"("templateId", "status");

-- CreateIndex
CREATE INDEX "UserCoupon_lockedOrderId_idx" ON "UserCoupon"("lockedOrderId");

-- CreateIndex
CREATE INDEX "UserCoupon_usedOrderId_idx" ON "UserCoupon"("usedOrderId");

-- CreateIndex
CREATE INDEX "OrderCouponApplication_userCouponId_idx" ON "OrderCouponApplication"("userCouponId");

-- CreateIndex
CREATE INDEX "OrderCouponApplication_couponTemplateId_idx" ON "OrderCouponApplication"("couponTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderCouponApplication_orderId_userCouponId_key" ON "OrderCouponApplication"("orderId", "userCouponId");

-- CreateIndex
CREATE INDEX "CouponGrantLog_customerId_reason_idx" ON "CouponGrantLog"("customerId", "reason");

-- CreateIndex
CREATE INDEX "CouponGrantLog_referrerCustomerId_idx" ON "CouponGrantLog"("referrerCustomerId");

-- CreateIndex
CREATE INDEX "CouponGrantLog_referredCustomerId_idx" ON "CouponGrantLog"("referredCustomerId");

-- CreateIndex
CREATE INDEX "CouponRedemptionLog_userCouponId_action_idx" ON "CouponRedemptionLog"("userCouponId", "action");

-- CreateIndex
CREATE INDEX "CouponRedemptionLog_orderId_idx" ON "CouponRedemptionLog"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_customerId_key" ON "MemberProfile"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_inviteCode_key" ON "MemberProfile"("inviteCode");

-- CreateIndex
CREATE INDEX "MemberProfile_inviteCode_idx" ON "MemberProfile"("inviteCode");

-- CreateIndex
CREATE INDEX "SkuMemberPrice_isActive_idx" ON "SkuMemberPrice"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SkuMemberPrice_skuId_memberLevel_key" ON "SkuMemberPrice"("skuId", "memberLevel");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralRelation_referredCustomerId_key" ON "ReferralRelation"("referredCustomerId");

-- CreateIndex
CREATE INDEX "ReferralRelation_referrerCustomerId_idx" ON "ReferralRelation"("referrerCustomerId");

-- CreateIndex
CREATE INDEX "ReferralRelation_inviteCode_idx" ON "ReferralRelation"("inviteCode");

-- CreateIndex
CREATE INDEX "ReferralRelation_status_idx" ON "ReferralRelation"("status");

-- CreateIndex
CREATE INDEX "ReferralReward_receiverCustomerId_status_idx" ON "ReferralReward"("receiverCustomerId", "status");

-- CreateIndex
CREATE INDEX "ReferralEvent_customerId_eventType_idx" ON "ReferralEvent"("customerId", "eventType");

-- CreateIndex
CREATE INDEX "ReferralEvent_inviteCode_idx" ON "ReferralEvent"("inviteCode");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_isDefault_idx" ON "CustomerAddress"("customerId", "isDefault");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_updatedAt_idx" ON "CustomerAddress"("customerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderShippingAddressSnapshot_orderId_key" ON "OrderShippingAddressSnapshot"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PickupRecord_orderId_key" ON "PickupRecord"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_paymentRef_key" ON "PaymentRecord"("paymentRef");

-- CreateIndex
CREATE INDEX "InventoryLog_operatorAdminId_idx" ON "InventoryLog"("operatorAdminId");

-- CreateIndex
CREATE INDEX "InventoryLog_storeId_skuId_idx" ON "InventoryLog"("storeId", "skuId");

-- CreateIndex
CREATE INDEX "OrderStatusLog_operatorAdminId_idx" ON "OrderStatusLog"("operatorAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_role_isActive_idx" ON "AdminUser"("role", "isActive");

-- CreateIndex
CREATE INDEX "AdminUser_storeId_idx" ON "AdminUser"("storeId");

-- AddForeignKey
ALTER TABLE "Sku" ADD CONSTRAINT "Sku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSkuAvailability" ADD CONSTRAINT "StoreSkuAvailability_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSkuAvailability" ADD CONSTRAINT "StoreSkuAvailability_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCoupon" ADD CONSTRAINT "UserCoupon_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CouponTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCouponApplication" ADD CONSTRAINT "OrderCouponApplication_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCouponApplication" ADD CONSTRAINT "OrderCouponApplication_userCouponId_fkey" FOREIGN KEY ("userCouponId") REFERENCES "UserCoupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCouponApplication" ADD CONSTRAINT "OrderCouponApplication_couponTemplateId_fkey" FOREIGN KEY ("couponTemplateId") REFERENCES "CouponTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponGrantLog" ADD CONSTRAINT "CouponGrantLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CouponTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponGrantLog" ADD CONSTRAINT "CouponGrantLog_userCouponId_fkey" FOREIGN KEY ("userCouponId") REFERENCES "UserCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemptionLog" ADD CONSTRAINT "CouponRedemptionLog_userCouponId_fkey" FOREIGN KEY ("userCouponId") REFERENCES "UserCoupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkuMemberPrice" ADD CONSTRAINT "SkuMemberPrice_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "ReferralRelation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderShippingAddressSnapshot" ADD CONSTRAINT "OrderShippingAddressSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRecord" ADD CONSTRAINT "PickupRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_operatorAdminId_fkey" FOREIGN KEY ("operatorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusLog" ADD CONSTRAINT "OrderStatusLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusLog" ADD CONSTRAINT "OrderStatusLog_operatorAdminId_fkey" FOREIGN KEY ("operatorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

