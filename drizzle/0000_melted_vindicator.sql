CREATE TABLE "bot_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"last_nonce" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claimed_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tx_hash" text NOT NULL,
	"game_type" text NOT NULL,
	"game_id" integer NOT NULL,
	"player_address" text NOT NULL,
	"amount_crc" integer NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "claimed_payments_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_type" text NOT NULL,
	"game_id" text NOT NULL,
	"recipient_address" text NOT NULL,
	"amount_crc" real NOT NULL,
	"reason" text,
	"wrap_tx_hash" text,
	"transfer_tx_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payouts_game_id_unique" UNIQUE("game_id")
);
--> statement-breakpoint
CREATE TABLE "auth_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"nonce" text NOT NULL,
	"message" text NOT NULL,
	"expected_address" text,
	"tx_hash" text,
	"signature" text,
	"refund_tx_hash" text,
	"verify_token_hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"origin" text,
	"metadata" jsonb,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "auth_challenges_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"address" text NOT NULL,
	"origin" text NOT NULL,
	"last_auth_challenge_id" integer,
	"user_agent_hash" text,
	"expires_at" timestamp NOT NULL,
	"hard_expires_at" timestamp NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	"last_refreshed_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "garage_referral_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle" text DEFAULT 'cycle-01' NOT NULL,
	"referrer_address" text NOT NULL,
	"referred_address" text NOT NULL,
	"threshold" integer NOT NULL,
	"amount_crc" real NOT NULL,
	"qualifying_claims" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payout_id" integer,
	"payout_status" text,
	"payout_tx_hash" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garage_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle" text DEFAULT 'cycle-01' NOT NULL,
	"referrer_address" text NOT NULL,
	"referred_address" text NOT NULL,
	"landing_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garage_x_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"x_user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garage_x_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"action" text NOT NULL,
	"tweet_id" text,
	"tweet_url" text,
	"target_x_user_id" text,
	"target_username" text,
	"reward_crc" real NOT NULL,
	"budget_crc" real NOT NULL,
	"max_claims" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by_address" text,
	"funding_status" text DEFAULT 'funded' NOT NULL,
	"funding_required_crc" real DEFAULT 0 NOT NULL,
	"platform_fee_crc" real DEFAULT 0 NOT NULL,
	"funding_tx_hash" text,
	"funded_at" timestamp,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garage_x_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"wallet_address" text NOT NULL,
	"x_user_id" text NOT NULL,
	"x_username" text NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'verified' NOT NULL,
	"verification_evidence" text,
	"verification_checked" integer DEFAULT 0 NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"payout_available_at" timestamp,
	"payout_id" integer,
	"payout_status" text,
	"payout_tx_hash" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garage_x_verification_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"tweet_id" text NOT NULL,
	"x_user_id" text NOT NULL,
	"evidence" text NOT NULL,
	"checked" integer DEFAULT 0 NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_challenges_nonce_idx" ON "auth_challenges" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "auth_challenges_status_idx" ON "auth_challenges" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auth_challenges_expires_at_idx" ON "auth_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "auth_challenges_tx_hash_idx" ON "auth_challenges" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_token_hash_idx" ON "auth_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_sessions_address_idx" ON "auth_sessions" USING btree ("address");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_referral_rewards_cycle_referred_threshold_idx" ON "garage_referral_rewards" USING btree ("cycle","referred_address","threshold");--> statement-breakpoint
CREATE INDEX "garage_referral_rewards_referrer_idx" ON "garage_referral_rewards" USING btree ("referrer_address");--> statement-breakpoint
CREATE INDEX "garage_referral_rewards_referred_idx" ON "garage_referral_rewards" USING btree ("referred_address");--> statement-breakpoint
CREATE INDEX "garage_referral_rewards_status_idx" ON "garage_referral_rewards" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_referrals_cycle_referred_idx" ON "garage_referrals" USING btree ("cycle","referred_address");--> statement-breakpoint
CREATE INDEX "garage_referrals_referrer_idx" ON "garage_referrals" USING btree ("referrer_address");--> statement-breakpoint
CREATE INDEX "garage_referrals_referred_idx" ON "garage_referrals" USING btree ("referred_address");--> statement-breakpoint
CREATE INDEX "garage_referrals_cycle_idx" ON "garage_referrals" USING btree ("cycle");--> statement-breakpoint
CREATE INDEX "garage_referrals_created_at_idx" ON "garage_referrals" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_x_accounts_wallet_uidx" ON "garage_x_accounts" USING btree ("wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_x_accounts_x_user_uidx" ON "garage_x_accounts" USING btree ("x_user_id");--> statement-breakpoint
CREATE INDEX "garage_x_accounts_username_idx" ON "garage_x_accounts" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_x_campaigns_slug_uidx" ON "garage_x_campaigns" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "garage_x_campaigns_status_idx" ON "garage_x_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "garage_x_campaigns_action_idx" ON "garage_x_campaigns" USING btree ("action");--> statement-breakpoint
CREATE INDEX "garage_x_campaigns_created_at_idx" ON "garage_x_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "garage_x_campaigns_funding_status_idx" ON "garage_x_campaigns" USING btree ("funding_status");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_x_campaigns_funding_tx_hash_uidx" ON "garage_x_campaigns" USING btree ("funding_tx_hash");--> statement-breakpoint
CREATE INDEX "garage_x_campaigns_created_by_idx" ON "garage_x_campaigns" USING btree ("created_by_address");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_x_claims_campaign_wallet_uidx" ON "garage_x_claims" USING btree ("campaign_id","wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_x_claims_campaign_x_user_uidx" ON "garage_x_claims" USING btree ("campaign_id","x_user_id");--> statement-breakpoint
CREATE INDEX "garage_x_claims_campaign_idx" ON "garage_x_claims" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "garage_x_claims_wallet_idx" ON "garage_x_claims" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "garage_x_claims_x_user_idx" ON "garage_x_claims" USING btree ("x_user_id");--> statement-breakpoint
CREATE INDEX "garage_x_claims_status_idx" ON "garage_x_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "garage_x_claims_created_at_idx" ON "garage_x_claims" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "garage_x_verification_cache_action_tweet_user_uidx" ON "garage_x_verification_cache" USING btree ("action","tweet_id","x_user_id");--> statement-breakpoint
CREATE INDEX "garage_x_verification_cache_lookup_idx" ON "garage_x_verification_cache" USING btree ("action","tweet_id","x_user_id","expires_at");--> statement-breakpoint
CREATE INDEX "garage_x_verification_cache_observed_at_idx" ON "garage_x_verification_cache" USING btree ("observed_at");