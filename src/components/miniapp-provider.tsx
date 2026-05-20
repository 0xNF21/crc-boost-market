"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  isMiniApp as detectMiniApp,
  requestAddress,
  onWalletChange,
  onAppData,
  signMessage as bridgeSignMessage,
  sendTransactions,
  cleanup,
} from "@/lib/miniapp-bridge";
import { buildMiniAppCrcPaymentTransactions } from "@/lib/circles-miniapp-payment";

interface MiniAppContextValue {
  /** True if running inside the Circles Mini App iframe */
  isMiniApp: boolean;
  /** Wallet address from the Circles host (lowercase, null if not connected) */
  walletAddress: string | null;
  /** Build and send a CRC transfer through the Circles host wallet. */
  sendPayment: (to: string, amountCrc: number, data?: string) => Promise<string[]>;
  /**
   * Ask the Circles host to sign a message via passkey. Used by auth.
   * The signature is server-verified — `verified` is just a UX hint.
   */
  signMessage: (message: string) => Promise<{ signature: string; verified?: boolean }>;
}

const MiniAppContext = createContext<MiniAppContextValue>({
  isMiniApp: false,
  walletAddress: null,
  sendPayment: () => Promise.reject("Not in Mini App mode"),
  signMessage: () => Promise.reject("Not in Mini App mode"),
});

export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [miniApp, setMiniApp] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const isInIframe = detectMiniApp();
    setMiniApp(isInIframe);

    if (!isInIframe) return;

    // Listen for wallet changes from the host
    const unsubWallet = onWalletChange((addr) => {
      setWalletAddress(addr);
    });

    // Listen for deep link data from the host (e.g. "lootbox/bronze", "loterie/weekly")
    const unsubData = onAppData((data) => {
      // Navigate to the path received from the host
      if (data.startsWith("/")) {
        router.push(data);
      } else {
        router.push(`/${data}`);
      }
    });

    // Request the wallet address from the host
    requestAddress();

    return () => {
      unsubWallet();
      unsubData();
      cleanup();
    };
  }, [router]);

  const sendPayment = useCallback(
    async (to: string, amountCrc: number, data?: string): Promise<string[]> => {
      if (!miniApp) throw new Error("Not in Mini App mode");
      if (!walletAddress) throw new Error("Mini App wallet is not connected");

      const transactions = await buildMiniAppCrcPaymentTransactions({
        from: walletAddress,
        to,
        amountCrc,
        data,
      });

      return sendTransactions(transactions);
    },
    [miniApp, walletAddress]
  );

  const signMessage = useCallback(
    async (message: string): Promise<{ signature: string; verified?: boolean }> => {
      if (!miniApp) throw new Error("Not in Mini App mode");
      return bridgeSignMessage(message, "erc1271");
    },
    [miniApp]
  );

  return (
    <MiniAppContext.Provider value={{ isMiniApp: miniApp, walletAddress, sendPayment, signMessage }}>
      {children}
    </MiniAppContext.Provider>
  );
}

export function useMiniApp() {
  return useContext(MiniAppContext);
}
