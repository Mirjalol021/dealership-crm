-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('PIECE', 'LITER', 'SET', 'OTHER');

-- CreateEnum
CREATE TYPE "AfterSalesCategory" AS ENUM ('ENGINE_OIL', 'OIL_FILTER', 'AIR_FILTER', 'CABIN_FILTER', 'FUEL_FILTER', 'BRAKE_FLUID', 'COOLANT', 'SPARK_PLUG', 'BRAKE_PADS', 'OTHER_PARTS', 'OTHER_CONSUMABLES');

-- CreateEnum
CREATE TYPE "StockAdjustmentReason" AS ENUM ('DAMAGED', 'PHYSICAL_INVENTORY_CORRECTION', 'RETURNED', 'OTHER');

-- AlterTable
ALTER TABLE "SoldCar" ADD COLUMN     "afterSalesNotes" TEXT,
ADD COLUMN     "currentMileage" INTEGER,
ADD COLUMN     "lastServiceDate" TIMESTAMP(3),
ADD COLUMN     "nextServiceDate" TIMESTAMP(3),
ADD COLUMN     "nextServiceMileage" INTEGER;

-- CreateTable
CREATE TABLE "ServiceVisit" (
    "id" TEXT NOT NULL,
    "soldCarId" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mileage" INTEGER,
    "serviceStaffId" TEXT,
    "workPerformed" TEXT NOT NULL,
    "extraWorkPerformed" TEXT,
    "comment" TEXT,
    "nextServiceMileage" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "serviceRevenue" DECIMAL(14,2) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "paymentDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfterSalesInventoryItem" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "category" "AfterSalesCategory" NOT NULL,
    "itemName" TEXT NOT NULL,
    "compatibleBrandModel" TEXT,
    "partNumber" TEXT,
    "unit" "InventoryUnit" NOT NULL DEFAULT 'PIECE',
    "quantityOnHand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(14,2) NOT NULL,
    "purchaseCost" DECIMAL(14,2) NOT NULL,
    "minimumStock" DECIMAL(14,3),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AfterSalesInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfterSalesStockReceipt" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier" TEXT,
    "paymentMethod" "PaymentMethod",
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AfterSalesStockReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfterSalesInventoryUsage" (
    "id" TEXT NOT NULL,
    "serviceVisitId" TEXT NOT NULL,
    "soldCarId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "sellingPriceSnapshot" DECIMAL(14,2) NOT NULL,
    "costSnapshot" DECIMAL(14,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AfterSalesInventoryUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AfterSalesStockAdjustment" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityBefore" DECIMAL(14,3) NOT NULL,
    "quantityChange" DECIMAL(14,3) NOT NULL,
    "quantityAfter" DECIMAL(14,3) NOT NULL,
    "userId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" "StockAdjustmentReason" NOT NULL,
    "comment" TEXT,

    CONSTRAINT "AfterSalesStockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceVisit_soldCarId_idx" ON "ServiceVisit"("soldCarId");

-- CreateIndex
CREATE INDEX "ServiceVisit_serviceDate_idx" ON "ServiceVisit"("serviceDate");

-- CreateIndex
CREATE INDEX "ServiceVisit_nextServiceDate_idx" ON "ServiceVisit"("nextServiceDate");

-- CreateIndex
CREATE INDEX "AfterSalesInventoryItem_dealershipId_idx" ON "AfterSalesInventoryItem"("dealershipId");

-- CreateIndex
CREATE INDEX "AfterSalesInventoryItem_category_idx" ON "AfterSalesInventoryItem"("category");

-- CreateIndex
CREATE INDEX "AfterSalesStockReceipt_itemId_idx" ON "AfterSalesStockReceipt"("itemId");

-- CreateIndex
CREATE INDEX "AfterSalesInventoryUsage_serviceVisitId_idx" ON "AfterSalesInventoryUsage"("serviceVisitId");

-- CreateIndex
CREATE INDEX "AfterSalesInventoryUsage_itemId_idx" ON "AfterSalesInventoryUsage"("itemId");

-- CreateIndex
CREATE INDEX "AfterSalesStockAdjustment_itemId_idx" ON "AfterSalesStockAdjustment"("itemId");

-- CreateIndex
CREATE INDEX "SoldCar_nextServiceDate_idx" ON "SoldCar"("nextServiceDate");

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_soldCarId_fkey" FOREIGN KEY ("soldCarId") REFERENCES "SoldCar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceVisit" ADD CONSTRAINT "ServiceVisit_serviceStaffId_fkey" FOREIGN KEY ("serviceStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesInventoryItem" ADD CONSTRAINT "AfterSalesInventoryItem_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesStockReceipt" ADD CONSTRAINT "AfterSalesStockReceipt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AfterSalesInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesInventoryUsage" ADD CONSTRAINT "AfterSalesInventoryUsage_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesInventoryUsage" ADD CONSTRAINT "AfterSalesInventoryUsage_soldCarId_fkey" FOREIGN KEY ("soldCarId") REFERENCES "SoldCar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesInventoryUsage" ADD CONSTRAINT "AfterSalesInventoryUsage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AfterSalesInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AfterSalesStockAdjustment" ADD CONSTRAINT "AfterSalesStockAdjustment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AfterSalesInventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
