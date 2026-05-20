"use client";

import { TransferBuilder } from "@aboutcircles/sdk-transfers";
import { circlesConfig } from "@aboutcircles/sdk-utils";
import type { MiniAppTransaction } from "@/lib/miniapp-bridge";

type Address = `0x${string}`;

const CRC_DECIMALS = 18;

function assertAddress(value: string, label: string): asserts value is Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${label} is not a valid address`);
  }
}

function crcToAtto(amountCrc: number): bigint {
  if (!Number.isFinite(amountCrc) || amountCrc <= 0) {
    throw new Error("CRC amount must be positive");
  }

  const normalized = amountCrc.toString();
  const [whole, fraction = ""] = normalized.split(".");
  return BigInt(whole) * 10n ** BigInt(CRC_DECIMALS) + BigInt(fraction.padEnd(CRC_DECIMALS, "0"));
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export async function buildMiniAppCrcPaymentTransactions({
  from,
  to,
  amountCrc,
  data,
}: {
  from: string;
  to: string;
  amountCrc: number;
  data?: string;
}): Promise<MiniAppTransaction[]> {
  assertAddress(from, "Sender");
  assertAddress(to, "Recipient");

  const builder = new TransferBuilder(circlesConfig[100]);
  const txs = await builder.constructAdvancedTransfer(
    from,
    to,
    crcToAtto(amountCrc),
    {
      useWrappedBalances: true,
      txData: data ? textToBytes(data) : undefined,
    },
  );

  return txs.map((tx) => ({
    to: tx.to,
    data: tx.data,
    value: (tx.value ?? 0n).toString(),
  }));
}
