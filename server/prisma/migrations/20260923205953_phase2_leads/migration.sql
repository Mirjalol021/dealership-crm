-- CreateEnum
CREATE TYPE "LeadDistributionMode" AS ENUM ('MANAGER_SELF_PICK', 'CALL_CENTER_QUALIFICATION');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('NEW', 'WORKING', 'VISIT_PLANNED', 'VISITED_TEST_DRIVE', 'SOLD', 'LOST');

-- CreateEnum
CREATE TYPE "LeadResult" AS ENUM ('NO_ANSWER', 'CLIENT_BUSY', 'WRONG_NUMBER', 'INFO_GIVEN_VISIT_EXPECTED', 'INFO_GIVEN_THINKING', 'INTERESTED', 'NOT_INTERESTED', 'LEFT_INFO_BY_MISTAKE', 'ANOTHER_REGION', 'VISIT_PLANNED', 'TEST_DRIVE_COMPLETED', 'SOLD');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('NORMAL', 'PRIORITY');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('META', 'TELEGRAM', 'INSTAGRAM_ORGANIC', 'TELEGRAM_ORGANIC', 'WALK_IN', 'PHONE_CALL', 'REFERRAL', 'EXISTING_CUSTOMER', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PLANNED', 'ARRIVED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('SELF_PICK', 'CALL_CENTER', 'HEAD_OF_SALES', 'SUPER_ADMIN', 'REASSIGNMENT');

-- CreateEnum
CREATE TYPE "ActivityEvent" AS ENUM ('LEAD_CREATED', 'LEAD_ENTERED_POOL', 'LEAD_TAKEN', 'LEAD_ASSIGNED', 'LEAD_REASSIGNED', 'RESULT_UPDATED', 'FOLLOW_UP_SCHEDULED', 'PIPELINE_CHANGED', 'COMMENT_ADDED', 'VISIT_PLANNED', 'TEST_DRIVE_COMPLETED', 'SOLD', 'LOST');

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "leadDistributionMode" "LeadDistributionMode" NOT NULL DEFAULT 'MANAGER_SELF_PICK',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "primaryPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadPhone" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadPhone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "modelInterest" TEXT,
    "source" "LeadSource" NOT NULL,
    "campaign" TEXT,
    "formId" TEXT,
    "externalLeadId" TEXT,
    "assignedUserId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "priority" "LeadPriority" NOT NULL DEFAULT 'NORMAL',
    "pipelineStatus" "PipelineStatus" NOT NULL DEFAULT 'NEW',
    "lastResult" "LeadResult",
    "nextFollowUpAt" TIMESTAMP(3),
    "expectedVisitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstContactAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "visitedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadComment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadContactAttempt" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "result" "LeadResult" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadContactAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "event" "ActivityEvent" NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "assignedById" TEXT,
    "assignmentType" "AssignmentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dealershipId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "managerId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PLANNED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalLeadForm" (
    "id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "formId" TEXT NOT NULL,
    "formName" TEXT NOT NULL,
    "brandId" TEXT,
    "dealershipId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fieldMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalLeadForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadFormAnswer" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "externalFieldKey" TEXT NOT NULL,
    "questionLabelSnapshot" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadFormAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_primaryPhone_idx" ON "Customer"("primaryPhone");

-- CreateIndex
CREATE INDEX "LeadPhone_phone_idx" ON "LeadPhone"("phone");

-- CreateIndex
CREATE INDEX "LeadPhone_customerId_idx" ON "LeadPhone"("customerId");

-- CreateIndex
CREATE INDEX "Lead_pipelineStatus_idx" ON "Lead"("pipelineStatus");

-- CreateIndex
CREATE INDEX "Lead_assignedUserId_idx" ON "Lead"("assignedUserId");

-- CreateIndex
CREATE INDEX "Lead_dealershipId_idx" ON "Lead"("dealershipId");

-- CreateIndex
CREATE INDEX "Lead_brandId_idx" ON "Lead"("brandId");

-- CreateIndex
CREATE INDEX "Lead_nextFollowUpAt_idx" ON "Lead"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "LeadComment_leadId_idx" ON "LeadComment"("leadId");

-- CreateIndex
CREATE INDEX "LeadContactAttempt_leadId_idx" ON "LeadContactAttempt"("leadId");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");

-- CreateIndex
CREATE INDEX "LeadAssignment_leadId_idx" ON "LeadAssignment"("leadId");

-- CreateIndex
CREATE INDEX "Appointment_leadId_idx" ON "Appointment"("leadId");

-- CreateIndex
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalLeadForm_source_formId_key" ON "ExternalLeadForm"("source", "formId");

-- CreateIndex
CREATE INDEX "LeadFormAnswer_leadId_idx" ON "LeadFormAnswer"("leadId");

-- AddForeignKey
ALTER TABLE "LeadPhone" ADD CONSTRAINT "LeadPhone_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadComment" ADD CONSTRAINT "LeadComment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadComment" ADD CONSTRAINT "LeadComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadContactAttempt" ADD CONSTRAINT "LeadContactAttempt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadAssignment" ADD CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_dealershipId_fkey" FOREIGN KEY ("dealershipId") REFERENCES "Dealership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFormAnswer" ADD CONSTRAINT "LeadFormAnswer_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
