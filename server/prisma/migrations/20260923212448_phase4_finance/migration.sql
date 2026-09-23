-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "KpiBonus" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "dealershipId" TEXT,
    "brandId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'EXPECTED',
    "receivedDate" TIMESTAMP(3),
    "receivedVia" "PaymentMethod",
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "accountingMonth" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "dealershipId" TEXT,
    "brandId" TEXT,
    "category" TEXT NOT NULL,
    "expenseType" "ExpenseType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "taxName" TEXT NOT NULL DEFAULT 'VAT',
    "taxRate" DECIMAL(6,2) NOT NULL DEFAULT 12,
    "taxBase" TEXT NOT NULL DEFAULT 'VEHICLE_MARGIN',
    "marginIsVatInclusive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KpiBonus_month_idx" ON "KpiBonus"("month");

-- CreateIndex
CREATE INDEX "KpiBonus_status_idx" ON "KpiBonus"("status");

-- CreateIndex
CREATE INDEX "Expense_accountingMonth_idx" ON "Expense"("accountingMonth");

-- CreateIndex
CREATE INDEX "Expense_paymentDate_idx" ON "Expense"("paymentDate");

-- CreateIndex
CREATE INDEX "Expense_dealershipId_idx" ON "Expense"("dealershipId");

-- AddForeignKey
ALTER TABLE "KpiBonus" ADD CONSTRAINT "KpiBonus_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiBonus" ADD CONSTRAINT "KpiBonus_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
