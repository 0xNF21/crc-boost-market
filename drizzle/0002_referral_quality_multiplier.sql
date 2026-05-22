ALTER TABLE "garage_referral_rewards" ADD COLUMN "base_amount_crc" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "garage_referral_rewards" ADD COLUMN "quality_multiplier" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "garage_referral_rewards" ADD COLUMN "referred_trust_score" integer;--> statement-breakpoint
ALTER TABLE "garage_referral_rewards" ADD COLUMN "referred_trust_level" text;--> statement-breakpoint
ALTER TABLE "garage_referral_rewards" ADD COLUMN "referred_backer_status" text;--> statement-breakpoint
UPDATE "garage_referral_rewards" SET "base_amount_crc" = "amount_crc" WHERE "base_amount_crc" = 0;
