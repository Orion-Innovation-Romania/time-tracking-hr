-- AlterTable
ALTER TABLE "User" ADD COLUMN "managedByConfig" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "passwordResetRequestedAt" TIMESTAMP(3);

-- Existing rows came from users.yml sync
UPDATE "User" SET "managedByConfig" = true;
