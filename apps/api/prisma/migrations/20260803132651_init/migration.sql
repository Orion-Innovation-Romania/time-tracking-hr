-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "DoorRole" AS ENUM ('IN', 'OUT', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('ACCESS_GRANTED', 'ACCESS_DENIED', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('vacation', 'sick', 'remote', 'other');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'COMMITTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportKind" AS ENUM ('summary', 'pontaj', 'raw');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('MIN_SESSION_MINUTES', 'GRACE_START_MINUTES', 'GRACE_END_MINUTES', 'ROUND_DAILY_MINUTES', 'IGNORE_ZONE', 'MAX_DAILY_MINUTES');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'user',
    "passwordHash" TEXT NOT NULL,
    "initialPasswordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "username" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,

    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAlias" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "rawUserName" TEXT NOT NULL,

    CONSTRAINT "EmployeeAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDepartment" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "department" TEXT NOT NULL,
    "fromDate" DATE,
    "toDate" DATE,

    CONSTRAINT "EmployeeDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSchedule" (
    "employeeId" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "workingDays" INTEGER[],

    CONSTRAINT "EmployeeSchedule_pkey" PRIMARY KEY ("employeeId")
);

-- CreateTable
CREATE TABLE "Door" (
    "id" SERIAL NOT NULL,
    "rawLocation" TEXT NOT NULL,
    "readerNo" INTEGER,
    "panel" TEXT,
    "floor" TEXT,
    "zone" TEXT,
    "role" "DoorRole" NOT NULL DEFAULT 'NEUTRAL',
    "displayName" TEXT,
    "autoDetected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Door_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "employeeId" INTEGER,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "department" TEXT,
    "rangeFrom" TIMESTAMP(3),
    "rangeTo" TIMESTAMP(3),
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsNew" INTEGER NOT NULL DEFAULT 0,
    "rowsDuplicate" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessEvent" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "doorId" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "DoorRole" NOT NULL,
    "eventType" "EventType" NOT NULL DEFAULT 'ACCESS_GRANTED',
    "importBatchId" INTEGER,

    CONSTRAINT "AccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "lunchMinutes" INTEGER NOT NULL DEFAULT 0,
    "firstIn" TIMESTAMP(3),
    "lastOut" TIMESTAMP(3),
    "perZone" JSONB NOT NULL DEFAULT '{}',
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "intervals" JSONB NOT NULL DEFAULT '[]',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "manualReason" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionRule" (
    "id" SERIAL NOT NULL,
    "type" "ConditionType" NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConditionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leave" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "type" "LeaveType" NOT NULL,
    "note" TEXT,

    CONSTRAINT "Leave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ExportTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ExportKind" NOT NULL,
    "layout" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "LoginHistory_username_at_idx" ON "LoginHistory"("username", "at");

-- CreateIndex
CREATE INDEX "LoginHistory_at_idx" ON "LoginHistory"("at");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_canonicalName_key" ON "Employee"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeAlias_rawUserName_key" ON "EmployeeAlias"("rawUserName");

-- CreateIndex
CREATE INDEX "EmployeeAlias_employeeId_idx" ON "EmployeeAlias"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDepartment_department_idx" ON "EmployeeDepartment"("department");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDepartment_employeeId_department_key" ON "EmployeeDepartment"("employeeId", "department");

-- CreateIndex
CREATE UNIQUE INDEX "Door_rawLocation_key" ON "Door"("rawLocation");

-- CreateIndex
CREATE INDEX "Door_zone_idx" ON "Door"("zone");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_fileHash_key" ON "ImportBatch"("fileHash");

-- CreateIndex
CREATE INDEX "ImportBatch_employeeId_idx" ON "ImportBatch"("employeeId");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "AccessEvent_employeeId_occurredAt_idx" ON "AccessEvent"("employeeId", "occurredAt");

-- CreateIndex
CREATE INDEX "AccessEvent_occurredAt_idx" ON "AccessEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccessEvent_employeeId_occurredAt_doorId_direction_key" ON "AccessEvent"("employeeId", "occurredAt", "doorId", "direction");

-- CreateIndex
CREATE INDEX "DailySummary_date_idx" ON "DailySummary"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_employeeId_date_key" ON "DailySummary"("employeeId", "date");

-- CreateIndex
CREATE INDEX "ConditionRule_order_idx" ON "ConditionRule"("order");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Leave_date_idx" ON "Leave"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Leave_employeeId_date_key" ON "Leave"("employeeId", "date");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- AddForeignKey
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAlias" ADD CONSTRAINT "EmployeeAlias_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDepartment" ADD CONSTRAINT "EmployeeDepartment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSchedule" ADD CONSTRAINT "EmployeeSchedule_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "Door"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySummary" ADD CONSTRAINT "DailySummary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportTemplate" ADD CONSTRAINT "ExportTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
