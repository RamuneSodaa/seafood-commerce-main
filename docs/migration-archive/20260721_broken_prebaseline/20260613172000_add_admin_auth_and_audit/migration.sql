CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'STORE_STAFF');

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

CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
CREATE INDEX "AdminUser_role_isActive_idx" ON "AdminUser"("role", "isActive");
CREATE INDEX "AdminUser_storeId_idx" ON "AdminUser"("storeId");

ALTER TABLE "AdminUser"
ADD CONSTRAINT "AdminUser_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryLog"
ADD COLUMN "storeId" TEXT,
ADD COLUMN "skuId" TEXT,
ADD COLUMN "oldAvailableStock" INTEGER,
ADD COLUMN "newAvailableStock" INTEGER,
ADD COLUMN "oldReservedStock" INTEGER,
ADD COLUMN "newReservedStock" INTEGER,
ADD COLUMN "oldPhysicalStock" INTEGER,
ADD COLUMN "newPhysicalStock" INTEGER,
ADD COLUMN "reason" TEXT,
ADD COLUMN "operatorAdminId" TEXT;

CREATE INDEX "InventoryLog_operatorAdminId_idx" ON "InventoryLog"("operatorAdminId");
CREATE INDEX "InventoryLog_storeId_skuId_idx" ON "InventoryLog"("storeId", "skuId");

ALTER TABLE "InventoryLog"
ADD CONSTRAINT "InventoryLog_operatorAdminId_fkey"
FOREIGN KEY ("operatorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderStatusLog"
ADD COLUMN "action" TEXT,
ADD COLUMN "operatorAdminId" TEXT;

CREATE INDEX "OrderStatusLog_operatorAdminId_idx" ON "OrderStatusLog"("operatorAdminId");

ALTER TABLE "OrderStatusLog"
ADD CONSTRAINT "OrderStatusLog_operatorAdminId_fkey"
FOREIGN KEY ("operatorAdminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
