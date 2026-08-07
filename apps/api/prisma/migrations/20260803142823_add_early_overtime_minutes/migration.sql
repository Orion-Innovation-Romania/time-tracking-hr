-- AlterTable
ALTER TABLE "DailySummary" ADD COLUMN     "earlyMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtimeMinutes" INTEGER NOT NULL DEFAULT 0;
