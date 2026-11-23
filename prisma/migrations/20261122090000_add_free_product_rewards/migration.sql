ALTER TABLE "RewardRule"
  ADD COLUMN "giftVariantIds" TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN "giftSelectionMode" TEXT NOT NULL DEFAULT 'FIXED';

ALTER TABLE "RewardRedemption"
  ADD COLUMN "giftVariantId" TEXT,
  ADD COLUMN "giftNameSnapshot" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN "isGift" BOOLEAN NOT NULL DEFAULT false;
