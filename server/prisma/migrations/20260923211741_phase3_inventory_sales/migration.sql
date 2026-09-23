-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('LLC_ACCOUNT', 'CASH', 'CARD');

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('EXPECTED', 'CONFIRMED', 'PAID');

-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('TONIROVKA', 'POLIK', 'REGISTRATION', 'FUEL', 'GIFT', 'OTHER');

-- CreateTable
CREATE TABLE "InventoryVehicle" (
    "id" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "color" TEXT,
    "vin" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellingPrice" DECIMAL(14,2),
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleReservation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT,
    "leadId" TEXT,
    "salesManagerId" TEXT,
    "reservationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "depositAmount" DECIMAL(14,2) NOT NULL,
    "depositPaymentMethod" "PaymentMethod",
    "expirationDate" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoldCar" (
    "id" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dealershipId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT,
    "salesManagerId" TEXT,
    "salePrice" DECIMAL(14,2) NOT NULL,
    "paymentType" "PaymentType" NOT NULL,
    "financeProductText" TEXT,
    "manualMargin" DECIMAL(14,2) NOT NULL,
    "discountedSale" BOOLEAN NOT NULL DEFAULT false,
    "discountAmount" DECIMAL(14,2),
    "discountComment" TEXT,
    "vehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoldCar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleCustomerBonus" (
    "id" TEXT NOT NULL,
    "soldCarId" TEXT NOT NULL,
    "bonusType" "BonusType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidFrom" "PaymentMethod" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleCustomerBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VinDistributorBonus" (
    "id" TEXT NOT NULL,
    "soldCarId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "accountingMonth" TEXT NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'EXPECTED',
    "receivedDate" TIMESTAMP(3),
    "receivedVia" "PaymentMethod",
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VinDistributorBonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryVehicle_vin_key" ON "InventoryVehicle"("vin");

-- CreateIndex
CREATE INDEX "InventoryVehicle_status_idx" ON "InventoryVehicle"("status");

-- CreateIndex
CREATE INDEX "InventoryVehicle_dealershipId_idx" ON "InventoryVehicle"("dealershipId");

-- CreateIndex
CREATE INDEX "InventoryVehicle_brandId_idx" ON "InventoryVehicle"("brandId");

-- CreateIndex
CREATE INDEX "VehicleReservation_vehicleId_idx" ON "VehicleReservation"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleReservation_customerId_idx" ON "VehicleReservation"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "SoldCar_vin_key" ON "SoldCar"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "SoldCar_vehicleId_key" ON "SoldCar"("vehicleId");

-- CreateIndex
CREATE INDEX "SoldCar_saleDate_idx" ON "SoldCar"("saleDate");

-- CreateIndex
CREATE INDEX "SoldCar_dealershipId_idx" ON "SoldCar"("dealershipId");

-- CreateIndex
CREATE INDEX "SoldCar_brandId_idx" ON "SoldCar"("brandId");

-- CreateIndex
CREATE INDEX "VehicleCustomerBonus_soldCarId_idx" ON "VehicleCustomerBonus"("soldCarId");

-- CreateIndex
CREATE INDEX "VinDistributorBonus_soldCarId_idx" ON "VinDistributorBonus"("soldCarId");

-- CreateIndex
CREATE INDEX "VinDistributorBonus_status_idx" ON "VinDistributorBonus"("status");

-- AddForeignKey
ALTER TABLE "InventoryVehicle" ADD CONSTRAINT "InventoryVehicle_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryVehicle" ADD CONSTRAINT "InventoryVehicle_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "InventoryVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_salesManagerId_fkey" FOREIGN KEY ("salesManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoldCar" ADD CONSTRAINT "SoldCar_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoldCar" ADD CONSTRAINT "SoldCar_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoldCar" ADD CONSTRAINT "SoldCar_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoldCar" ADD CONSTRAINT "SoldCar_salesManagerId_fkey" FOREIGN KEY ("salesManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoldCar" ADD CONSTRAINT "SoldCar_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "InventoryVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleCustomerBonus" ADD CONSTRAINT "VehicleCustomerBonus_soldCarId_fkey" FOREIGN KEY ("soldCarId") REFERENCES "SoldCar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VinDistributorBonus" ADD CONSTRAINT "VinDistributorBonus_soldCarId_fkey" FOREIGN KEY ("soldCarId") REFERENCES "SoldCar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
