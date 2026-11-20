CREATE TABLE IF NOT EXISTS "ReconciliationDifference" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityName" TEXT,
  "expectedAmount" INTEGER NOT NULL,
  "actualAmount" INTEGER NOT NULL,
  "differenceAmount" INTEGER NOT NULL,
  "reasonCategory" TEXT NOT NULL,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolutionNotes" TEXT,
  "createdByEmployeeId" TEXT,
  "resolvedByEmployeeId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReconciliationDifference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReconciliationDifference_reference_key" ON "ReconciliationDifference"("reference");
CREATE INDEX IF NOT EXISTS "ReconciliationDifference_entityType_status_idx" ON "ReconciliationDifference"("entityType", "status");
CREATE INDEX IF NOT EXISTS "ReconciliationDifference_createdAt_idx" ON "ReconciliationDifference"("createdAt");

CREATE TABLE IF NOT EXISTS "OfficialReport" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "reportTitle" TEXT NOT NULL,
  "targetEntityName" TEXT,
  "periodFrom" TIMESTAMP(3),
  "periodTo" TIMESTAMP(3),
  "isDetailed" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "summaryPayload" JSONB NOT NULL,
  "dataPayload" JSONB NOT NULL,
  "filterPayload" JSONB,
  "sealUrlSnapshot" TEXT,
  "issuedByEmployeeId" TEXT,
  "issuedByEmployeeName" TEXT NOT NULL,
  "issuedByEmployeeRole" TEXT NOT NULL,
  "approvedByEmployeeId" TEXT,
  "approvedByEmployeeName" TEXT,
  "approvedAt" TIMESTAMP(3),
  "supersededByRef" TEXT,
  "verificationToken" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "sha256Hash" TEXT,
  "fileUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficialReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OfficialReport_reference_key" ON "OfficialReport"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "OfficialReport_verificationToken_key" ON "OfficialReport"("verificationToken");
CREATE INDEX IF NOT EXISTS "OfficialReport_department_createdAt_idx" ON "OfficialReport"("department", "createdAt");
CREATE INDEX IF NOT EXISTS "OfficialReport_reference_idx" ON "OfficialReport"("reference");

CREATE TABLE IF NOT EXISTS "EmployeePayAgreement" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "employeeId" TEXT NOT NULL,
  "payCycle" TEXT NOT NULL DEFAULT 'WEEKLY',
  "baseRateFils" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'JOD',
  "contractType" TEXT NOT NULL DEFAULT 'PART_TIME',
  "weeklyAgreedHours" INTEGER,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdByEmployeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePayAgreement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmployeePayAgreement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmployeePayAgreement_employeeId_isActive_idx" ON "EmployeePayAgreement"("employeeId", "isActive");

CREATE TABLE IF NOT EXISTS "PayrollPeriod" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "grossAmountFils" INTEGER NOT NULL,
  "deductionsFils" INTEGER NOT NULL DEFAULT 0,
  "allowancesFils" INTEGER NOT NULL DEFAULT 0,
  "netPayableFils" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACCRUED',
  "accruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accruedByEmployeeId" TEXT,
  "notes" TEXT,
  "financialTxId" TEXT,
  CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollPeriod_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "EmployeePayAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPeriod_reference_key" ON "PayrollPeriod"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPeriod_financialTxId_key" ON "PayrollPeriod"("financialTxId");
CREATE INDEX IF NOT EXISTS "PayrollPeriod_employeeId_status_idx" ON "PayrollPeriod"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "PayrollPeriod_periodFrom_periodTo_idx" ON "PayrollPeriod"("periodFrom", "periodTo");

CREATE TABLE IF NOT EXISTS "PayrollPayment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "payrollPeriodId" TEXT NOT NULL,
  "amountFils" INTEGER NOT NULL,
  "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
  "paymentReference" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidByEmployeeId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "notes" TEXT,
  "financialTxId" TEXT,
  CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollPayment_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPayment_reference_key" ON "PayrollPayment"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPayment_payrollPeriodId_key" ON "PayrollPayment"("payrollPeriodId");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPayment_idempotencyKey_key" ON "PayrollPayment"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPayment_financialTxId_key" ON "PayrollPayment"("financialTxId");
CREATE INDEX IF NOT EXISTS "PayrollPayment_paidAt_idx" ON "PayrollPayment"("paidAt");

CREATE TABLE IF NOT EXISTS "ProfitClose" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "periodFrom" TIMESTAMP(3) NOT NULL,
  "periodTo" TIMESTAMP(3) NOT NULL,
  "grossRevenueFils" INTEGER NOT NULL,
  "supplierObligationsFils" INTEGER NOT NULL,
  "platformGrossMarginFils" INTEGER NOT NULL,
  "courierCostsFils" INTEGER NOT NULL,
  "operatingExpensesFils" INTEGER NOT NULL,
  "staffSalariesFils" INTEGER NOT NULL,
  "taxContingencyFils" INTEGER NOT NULL DEFAULT 0,
  "netProfitFils" INTEGER NOT NULL,
  "reservePercentage" INTEGER NOT NULL DEFAULT 20,
  "internalReserveFils" INTEGER NOT NULL,
  "distributableProfitFils" INTEGER NOT NULL,
  "safeLiquidCashFils" INTEGER NOT NULL,
  "actualApprovedDistributionFils" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "closedAt" TIMESTAMP(3),
  "closedByEmployeeId" TEXT,
  "partner1Approved" BOOLEAN NOT NULL DEFAULT false,
  "partner1ApprovedAt" TIMESTAMP(3),
  "partner1EmployeeId" TEXT,
  "partner2Approved" BOOLEAN NOT NULL DEFAULT false,
  "partner2ApprovedAt" TIMESTAMP(3),
  "partner2EmployeeId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfitClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfitClose_reference_key" ON "ProfitClose"("reference");
CREATE INDEX IF NOT EXISTS "ProfitClose_periodFrom_periodTo_idx" ON "ProfitClose"("periodFrom", "periodTo");
CREATE INDEX IF NOT EXISTS "ProfitClose_status_idx" ON "ProfitClose"("status");

CREATE TABLE IF NOT EXISTS "PartnerShareRule" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "partnerName" TEXT NOT NULL,
  "partnerEmployeeId" TEXT,
  "sharePercentage" INTEGER NOT NULL DEFAULT 50,
  "bankDetails" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartnerShareRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerShareRule_partnerName_isActive_idx" ON "PartnerShareRule"("partnerName", "isActive");

CREATE TABLE IF NOT EXISTS "ProfitDistribution" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "profitCloseId" TEXT NOT NULL,
  "totalDistributedFils" INTEGER NOT NULL,
  "partner1AmountFils" INTEGER NOT NULL,
  "partner2AmountFils" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYOUT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfitDistribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProfitDistribution_profitCloseId_fkey" FOREIGN KEY ("profitCloseId") REFERENCES "ProfitClose"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfitDistribution_reference_key" ON "ProfitDistribution"("reference");
CREATE INDEX IF NOT EXISTS "ProfitDistribution_profitCloseId_idx" ON "ProfitDistribution"("profitCloseId");

CREATE TABLE IF NOT EXISTS "PartnerPayout" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "reference" TEXT NOT NULL,
  "partnerRuleId" TEXT NOT NULL,
  "distributionId" TEXT,
  "payoutType" TEXT NOT NULL,
  "amountFils" INTEGER NOT NULL,
  "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  "paymentReference" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorizedByAdmin" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "notes" TEXT,
  "financialTxId" TEXT,
  CONSTRAINT "PartnerPayout_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PartnerPayout_partnerRuleId_fkey" FOREIGN KEY ("partnerRuleId") REFERENCES "PartnerShareRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PartnerPayout_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "ProfitDistribution"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PartnerPayout_reference_key" ON "PartnerPayout"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerPayout_idempotencyKey_key" ON "PartnerPayout"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerPayout_financialTxId_key" ON "PartnerPayout"("financialTxId");
CREATE INDEX IF NOT EXISTS "PartnerPayout_partnerRuleId_payoutType_idx" ON "PartnerPayout"("partnerRuleId", "payoutType");
CREATE INDEX IF NOT EXISTS "PartnerPayout_paidAt_idx" ON "PartnerPayout"("paidAt");
