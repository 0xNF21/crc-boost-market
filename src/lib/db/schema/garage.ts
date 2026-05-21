import { boolean, index, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const garageReferrals = pgTable(
  "garage_referrals",
  {
    id: serial("id").primaryKey(),
    cycle: text("cycle").notNull().default("cycle-01"),
    referrerAddress: text("referrer_address").notNull(),
    referredAddress: text("referred_address").notNull(),
    landingPath: text("landing_path"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCycleReferred: uniqueIndex("garage_referrals_cycle_referred_idx").on(
      table.cycle,
      table.referredAddress,
    ),
    referrerIdx: index("garage_referrals_referrer_idx").on(table.referrerAddress),
    referredIdx: index("garage_referrals_referred_idx").on(table.referredAddress),
    cycleIdx: index("garage_referrals_cycle_idx").on(table.cycle),
    createdAtIdx: index("garage_referrals_created_at_idx").on(table.createdAt),
  }),
);

export type GarageReferral = typeof garageReferrals.$inferSelect;
export type NewGarageReferral = typeof garageReferrals.$inferInsert;

export const garageReferralRewards = pgTable(
  "garage_referral_rewards",
  {
    id: serial("id").primaryKey(),
    cycle: text("cycle").notNull().default("cycle-01"),
    referrerAddress: text("referrer_address").notNull(),
    referredAddress: text("referred_address").notNull(),
    threshold: integer("threshold").notNull(),
    amountCrc: real("amount_crc").notNull(),
    qualifyingClaims: integer("qualifying_claims").default(0).notNull(),
    status: text("status").notNull().default("pending"),
    payoutId: integer("payout_id"),
    payoutStatus: text("payout_status"),
    payoutTxHash: text("payout_tx_hash"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueCycleReferredThreshold: uniqueIndex("garage_referral_rewards_cycle_referred_threshold_idx").on(
      table.cycle,
      table.referredAddress,
      table.threshold,
    ),
    referrerIdx: index("garage_referral_rewards_referrer_idx").on(table.referrerAddress),
    referredIdx: index("garage_referral_rewards_referred_idx").on(table.referredAddress),
    statusIdx: index("garage_referral_rewards_status_idx").on(table.status),
  }),
);

export type GarageReferralReward = typeof garageReferralRewards.$inferSelect;
export type NewGarageReferralReward = typeof garageReferralRewards.$inferInsert;

export const garageXAccounts = pgTable(
  "garage_x_accounts",
  {
    id: serial("id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    xUserId: text("x_user_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    walletUnique: uniqueIndex("garage_x_accounts_wallet_uidx").on(table.walletAddress),
    xUserUnique: uniqueIndex("garage_x_accounts_x_user_uidx").on(table.xUserId),
    usernameIdx: index("garage_x_accounts_username_idx").on(table.username),
  }),
);

export const garageXCampaigns = pgTable(
  "garage_x_campaigns",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    action: text("action").notNull(),
    tweetId: text("tweet_id"),
    tweetUrl: text("tweet_url"),
    targetXUserId: text("target_x_user_id"),
    targetUsername: text("target_username"),
    rewardCrc: real("reward_crc").notNull(),
    budgetCrc: real("budget_crc").notNull(),
    maxClaims: integer("max_claims").notNull(),
    status: text("status").notNull().default("active"),
    createdByAddress: text("created_by_address"),
    fundingStatus: text("funding_status").notNull().default("funded"),
    fundingRequiredCrc: real("funding_required_crc").notNull().default(0),
    platformFeeCrc: real("platform_fee_crc").notNull().default(0),
    fundingTxHash: text("funding_tx_hash"),
    fundedAt: timestamp("funded_at"),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("garage_x_campaigns_slug_uidx").on(table.slug),
    statusIdx: index("garage_x_campaigns_status_idx").on(table.status),
    actionIdx: index("garage_x_campaigns_action_idx").on(table.action),
    createdAtIdx: index("garage_x_campaigns_created_at_idx").on(table.createdAt),
    fundingStatusIdx: index("garage_x_campaigns_funding_status_idx").on(table.fundingStatus),
    fundingTxHashIdx: uniqueIndex("garage_x_campaigns_funding_tx_hash_uidx").on(table.fundingTxHash),
    creatorIdx: index("garage_x_campaigns_created_by_idx").on(table.createdByAddress),
  }),
);

export const garageXClaims = pgTable(
  "garage_x_claims",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id").notNull(),
    walletAddress: text("wallet_address").notNull(),
    xUserId: text("x_user_id").notNull(),
    xUsername: text("x_username").notNull(),
    action: text("action").notNull(),
    status: text("status").notNull().default("verified"),
    verificationEvidence: text("verification_evidence"),
    verificationChecked: integer("verification_checked").default(0).notNull(),
    observedAt: timestamp("observed_at").defaultNow().notNull(),
    payoutAvailableAt: timestamp("payout_available_at"),
    payoutId: integer("payout_id"),
    payoutStatus: text("payout_status"),
    payoutTxHash: text("payout_tx_hash"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    campaignWalletUnique: uniqueIndex("garage_x_claims_campaign_wallet_uidx").on(
      table.campaignId,
      table.walletAddress,
    ),
    campaignXUserUnique: uniqueIndex("garage_x_claims_campaign_x_user_uidx").on(
      table.campaignId,
      table.xUserId,
    ),
    campaignIdx: index("garage_x_claims_campaign_idx").on(table.campaignId),
    walletIdx: index("garage_x_claims_wallet_idx").on(table.walletAddress),
    xUserIdx: index("garage_x_claims_x_user_idx").on(table.xUserId),
    statusIdx: index("garage_x_claims_status_idx").on(table.status),
    createdAtIdx: index("garage_x_claims_created_at_idx").on(table.createdAt),
  }),
);

export const garageXVerificationCache = pgTable(
  "garage_x_verification_cache",
  {
    id: serial("id").primaryKey(),
    action: text("action").notNull(),
    tweetId: text("tweet_id").notNull(),
    xUserId: text("x_user_id").notNull(),
    evidence: text("evidence").notNull(),
    checked: integer("checked").default(0).notNull(),
    observedAt: timestamp("observed_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueActionTweetUser: uniqueIndex("garage_x_verification_cache_action_tweet_user_uidx").on(
      table.action,
      table.tweetId,
      table.xUserId,
    ),
    lookupIdx: index("garage_x_verification_cache_lookup_idx").on(
      table.action,
      table.tweetId,
      table.xUserId,
      table.expiresAt,
    ),
    observedAtIdx: index("garage_x_verification_cache_observed_at_idx").on(table.observedAt),
  }),
);

export const garageTrustProfiles = pgTable(
  "garage_trust_profiles",
  {
    id: serial("id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    trustScore: integer("trust_score"),
    trustLevel: text("trust_level"),
    confidence: integer("confidence"),
    computedAt: timestamp("computed_at"),
    inDegree: integer("in_degree").default(0).notNull(),
    outDegree: integer("out_degree").default(0).notNull(),
    mutualCount: integer("mutual_count").default(0).notNull(),
    ageDays: integer("age_days").default(0).notNull(),
    backerStatus: text("backer_status").notNull().default("unknown"),
    directBacker: boolean("direct_backer").default(false).notNull(),
    indirectBackerTrustCount: integer("indirect_backer_trust_count").default(0).notNull(),
    indirectBackerAddresses: jsonb("indirect_backer_addresses").$type<string[]>().default([]).notNull(),
    source: text("source").notNull().default("circles-rpc"),
    errorMessage: text("error_message"),
    lastFetchedAt: timestamp("last_fetched_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    walletUnique: uniqueIndex("garage_trust_profiles_wallet_uidx").on(table.walletAddress),
    backerStatusIdx: index("garage_trust_profiles_backer_status_idx").on(table.backerStatus),
    expiresAtIdx: index("garage_trust_profiles_expires_at_idx").on(table.expiresAt),
    trustScoreIdx: index("garage_trust_profiles_trust_score_idx").on(table.trustScore),
  }),
);

export type GarageXAccount = typeof garageXAccounts.$inferSelect;
export type NewGarageXAccount = typeof garageXAccounts.$inferInsert;
export type GarageXCampaign = typeof garageXCampaigns.$inferSelect;
export type NewGarageXCampaign = typeof garageXCampaigns.$inferInsert;
export type GarageXClaim = typeof garageXClaims.$inferSelect;
export type NewGarageXClaim = typeof garageXClaims.$inferInsert;
export type GarageXVerificationCache = typeof garageXVerificationCache.$inferSelect;
export type NewGarageXVerificationCache = typeof garageXVerificationCache.$inferInsert;
export type GarageTrustProfile = typeof garageTrustProfiles.$inferSelect;
export type NewGarageTrustProfile = typeof garageTrustProfiles.$inferInsert;
