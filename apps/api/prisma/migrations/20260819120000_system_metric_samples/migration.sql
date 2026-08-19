-- CreateTable
CREATE TABLE "SystemMetricSample" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuPercent" DOUBLE PRECISION NOT NULL,
    "memUsedBytes" BIGINT NOT NULL,
    "memTotalBytes" BIGINT NOT NULL,
    "diskUsedBytes" BIGINT,
    "diskTotalBytes" BIGINT,
    "load1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "processRssBytes" BIGINT NOT NULL,

    CONSTRAINT "SystemMetricSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemMetricSample_at_idx" ON "SystemMetricSample"("at");
