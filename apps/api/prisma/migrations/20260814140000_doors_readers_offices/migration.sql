-- Physical doors (name / office / floor) with readers nested under them.
-- Existing Door rows are readers; group them by parsed zone + floor.

ALTER TABLE "Door" RENAME TO "Reader";
ALTER TABLE "Reader" RENAME CONSTRAINT "Door_pkey" TO "Reader_pkey";
ALTER INDEX "Door_rawLocation_key" RENAME TO "Reader_rawLocation_key";
ALTER INDEX "Door_zone_idx" RENAME TO "Reader_zone_idx";

ALTER TABLE "AccessEvent" DROP CONSTRAINT "AccessEvent_doorId_fkey";
ALTER TABLE "AccessEvent" RENAME COLUMN "doorId" TO "readerId";
ALTER INDEX "AccessEvent_employeeId_occurredAt_doorId_direction_key" RENAME TO "AccessEvent_employeeId_occurredAt_readerId_direction_key";

CREATE TABLE "Office" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Office_name_key" ON "Office"("name");

CREATE TABLE "Door" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "groupingKey" TEXT NOT NULL,
    "officeId" INTEGER,
    "floor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Door_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Door_groupingKey_key" ON "Door"("groupingKey");
CREATE INDEX "Door_officeId_idx" ON "Door"("officeId");
CREATE INDEX "Door_name_idx" ON "Door"("name");

ALTER TABLE "Door" ADD CONSTRAINT "Door_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Door" ("name", "floor", "groupingKey", "createdAt")
SELECT
    s.name,
    s.floor,
    s."groupingKey",
    MIN(s."createdAt")
FROM (
    SELECT
        COALESCE(NULLIF(TRIM(zone), ''), 'Unnamed') AS name,
        floor,
        lower(COALESCE(NULLIF(TRIM(zone), ''), 'unnamed')) || '|' || lower(COALESCE(floor, '')) AS "groupingKey",
        "createdAt"
    FROM "Reader"
) s
GROUP BY s.name, s.floor, s."groupingKey";

ALTER TABLE "Reader" ADD COLUMN "doorId" INTEGER;

UPDATE "Reader" r
SET "doorId" = d.id
FROM "Door" d
WHERE d."groupingKey" = lower(COALESCE(NULLIF(TRIM(r.zone), ''), 'unnamed')) || '|' || lower(COALESCE(r.floor, ''));

INSERT INTO "Door" ("name", "floor", "groupingKey", "createdAt")
SELECT
    COALESCE(NULLIF(TRIM(r.zone), ''), COALESCE(NULLIF(TRIM(r."displayName"), ''), 'Unnamed')) || ' #' || r.id,
    r.floor,
    'reader-' || r.id,
    r."createdAt"
FROM "Reader" r
WHERE r."doorId" IS NULL;

UPDATE "Reader" r
SET "doorId" = d.id
FROM "Door" d
WHERE r."doorId" IS NULL AND d."groupingKey" = 'reader-' || r.id;

ALTER TABLE "Reader" ALTER COLUMN "doorId" SET NOT NULL;
ALTER TABLE "Reader" ADD CONSTRAINT "Reader_doorId_fkey" FOREIGN KEY ("doorId") REFERENCES "Door"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Reader_doorId_idx" ON "Reader"("doorId");

DROP INDEX "Reader_zone_idx";
ALTER TABLE "Reader" DROP COLUMN "floor";
ALTER TABLE "Reader" DROP COLUMN "zone";
ALTER TABLE "Reader" DROP COLUMN "displayName";

ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "Reader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
