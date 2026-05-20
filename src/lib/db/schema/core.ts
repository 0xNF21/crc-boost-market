import { integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

export const payouts = pgTable("payouts", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull(),
  gameId: text("game_id").notNull().unique(),
  recipientAddress: text("recipient_address").notNull(),
  amountCrc: real("amount_crc").notNull(),
  reason: text("reason"),
  wrapTxHash: text("wrap_tx_hash"),
  transferTxHash: text("transfer_tx_hash"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const claimedPayments = pgTable("claimed_payments", {
  id: serial("id").primaryKey(),
  txHash: text("tx_hash").notNull().unique(),
  gameType: text("game_type").notNull(),
  gameId: integer("game_id").notNull(),
  playerAddress: text("player_address").notNull(),
  amountCrc: integer("amount_crc").notNull(),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
});

export const botState = pgTable("bot_state", {
  id: integer("id").primaryKey().default(1),
  lastNonce: integer("last_nonce").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
