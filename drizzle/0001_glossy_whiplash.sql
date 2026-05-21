CREATE TABLE "garage_trust_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"trust_score" integer,
	"trust_level" text,
	"confidence" integer,
	"computed_at" timestamp,
	"in_degree" integer DEFAULT 0 NOT NULL,
	"out_degree" integer DEFAULT 0 NOT NULL,
	"mutual_count" integer DEFAULT 0 NOT NULL,
	"age_days" integer DEFAULT 0 NOT NULL,
	"backer_status" text DEFAULT 'unknown' NOT NULL,
	"direct_backer" boolean DEFAULT false NOT NULL,
	"indirect_backer_trust_count" integer DEFAULT 0 NOT NULL,
	"indirect_backer_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'circles-rpc' NOT NULL,
	"error_message" text,
	"last_fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "garage_trust_profiles_wallet_uidx" ON "garage_trust_profiles" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "garage_trust_profiles_backer_status_idx" ON "garage_trust_profiles" USING btree ("backer_status");--> statement-breakpoint
CREATE INDEX "garage_trust_profiles_expires_at_idx" ON "garage_trust_profiles" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "garage_trust_profiles_trust_score_idx" ON "garage_trust_profiles" USING btree ("trust_score");