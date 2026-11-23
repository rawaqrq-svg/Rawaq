ALTER TABLE "FinancialTransaction"
  ADD COLUMN "fundAccount" TEXT NOT NULL DEFAULT 'UNALLOCATED',
  ADD COLUMN "transferToFundAccount" TEXT,
  ADD COLUMN "paymentMethod" TEXT,
  ADD COLUMN "receivedByEmployeeId" TEXT;

CREATE INDEX "FinancialTransaction_fundAccount_createdAt_idx"
  ON "FinancialTransaction"("fundAccount", "createdAt");

CREATE INDEX "FinancialTransaction_receivedByEmployeeId_createdAt_idx"
  ON "FinancialTransaction"("receivedByEmployeeId", "createdAt");
ALTER TABLE "SupplierSettlement"
  ADD COLUMN "financialTransactionId" TEXT;
ALTER TABLE "CaptainSettlement"
  ADD COLUMN "financialTransactionId" TEXT;
CREATE UNIQUE INDEX "SupplierSettlement_financialTransactionId_key"
  ON "SupplierSettlement"("financialTransactionId");
CREATE UNIQUE INDEX "CaptainSettlement_financialTransactionId_key"
  ON "CaptainSettlement"("financialTransactionId");
