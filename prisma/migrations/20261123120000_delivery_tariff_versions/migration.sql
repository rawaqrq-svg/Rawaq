CREATE TABLE "DeliveryTariffVersion" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "companyKey" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "createdByEmployeeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryTariffVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryTariffTier" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "minLocations" INTEGER NOT NULL,
  "maxLocations" INTEGER,
  "costFils" INTEGER NOT NULL,
  CONSTRAINT "DeliveryTariffTier_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeliveryBatch"
  ADD COLUMN "courierTariffVersionId" TEXT,
  ADD COLUMN "pickupLocationCount" INTEGER,
  ADD COLUMN "carrierTariffCostFils" INTEGER,
  ADD COLUMN "tariffEvaluatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "DeliveryTariffVersion_companyKey_effectiveFrom_key"
  ON "DeliveryTariffVersion"("companyKey", "effectiveFrom");
CREATE INDEX "DeliveryTariffVersion_companyKey_effectiveFrom_idx"
  ON "DeliveryTariffVersion"("companyKey", "effectiveFrom");
CREATE INDEX "DeliveryTariffTier_versionId_minLocations_idx"
  ON "DeliveryTariffTier"("versionId", "minLocations");

ALTER TABLE "DeliveryTariffTier"
  ADD CONSTRAINT "DeliveryTariffTier_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "DeliveryTariffVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryBatch"
  ADD CONSTRAINT "DeliveryBatch_courierTariffVersionId_fkey"
  FOREIGN KEY ("courierTariffVersionId") REFERENCES "DeliveryTariffVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
