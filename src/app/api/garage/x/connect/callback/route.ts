export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthenticatedAddress } from "@/lib/auth/session";
import { garageXAccounts } from "@/lib/db/schema";
import { readSignedXOAuthState } from "@/lib/garage-x-oauth-state";
import { enforceRateLimit } from "@/lib/rate-limit";

const OAUTH_COOKIE = "nfs_x_oauth";
const CIRCLES_PLAYGROUND_URL = "https://circles.gnosis.io/playground";

type PendingOAuth = {
  state: string;
  codeVerifier: string;
  address: string;
  returnTo: string;
  returnAfterAuth?: "playground";
};

type XTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type XMeResponse = {
  data?: {
    id: string;
    name?: string;
    username?: string;
  };
  errors?: unknown;
};

class XOAuthError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

function readPending(req: NextRequest): PendingOAuth | null {
  const raw = req.cookies.get(OAUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as PendingOAuth;
    if (!parsed?.state || !parsed?.codeVerifier || !parsed?.address) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getRedirectUri(req: NextRequest) {
  return process.env.X_REDIRECT_URI || `${req.nextUrl.origin}/api/garage/x/connect/callback`;
}

function getAppOrigin(req: NextRequest) {
  return new URL(getRedirectUri(req)).origin;
}

function clearCookie(res: NextResponse) {
  res.cookies.set({
    name: OAUTH_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function redirectTo(req: NextRequest, path: string, status: string) {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/garage";
  const url = new URL(safePath, getAppOrigin(req));
  url.searchParams.set("x", status);
  const res = NextResponse.redirect(url);
  clearCookie(res);
  return res;
}

function redirectAfterOAuth(req: NextRequest, pending: PendingOAuth, status: string) {
  if (status === "linked" && pending.returnAfterAuth === "playground") {
    const res = NextResponse.redirect(CIRCLES_PLAYGROUND_URL);
    clearCookie(res);
    return res;
  }

  return redirectTo(req, pending.returnTo, status);
}

async function exchangeCode(req: NextRequest, code: string, codeVerifier: string): Promise<string> {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) throw new Error("missing_x_client_id");
  const xClientId = clientId;

  const baseBody = {
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(req),
    code_verifier: codeVerifier,
  };

  const clientSecret = process.env.X_CLIENT_SECRET || process.env.TWITTER_CLIENT_SECRET;

  async function requestToken(useBasicAuth: boolean): Promise<string> {
    const body = new URLSearchParams(baseBody);
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (useBasicAuth && clientSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${xClientId}:${clientSecret}`).toString("base64")}`;
    } else {
      body.set("client_id", xClientId);
    }

    const res = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as XTokenResponse;
    if (!res.ok || !data.access_token) {
      const detail = [data.error, data.error_description].filter(Boolean).join(": ");
      throw new XOAuthError(detail || `x_token_${res.status}`, res.status, data.error);
    }
    return data.access_token;
  }

  if (clientSecret) {
    try {
      return await requestToken(true);
    } catch (error: any) {
      const message = String(error?.message ?? error).toLowerCase();
      if (!message.includes("authorization") && !message.includes("client")) {
        throw error;
      }
      console.warn("[garage/x/connect/callback] confidential token exchange failed, retrying public PKCE:", error?.message ?? error);
    }
  }
  return requestToken(false);
}

async function fetchXMe(accessToken: string): Promise<{ id: string; username: string; name: string | null }> {
  const res = await fetch("https://api.x.com/2/users/me?user.fields=username,name", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as XMeResponse;
  if (!res.ok || !data.data?.id || !data.data?.username) {
    throw new Error(`x_me_${res.status}`);
  }
  return {
    id: data.data.id,
    username: data.data.username,
    name: data.data.name ?? null,
  };
}

function classifyOAuthError(error: unknown) {
  if (error instanceof XOAuthError) {
    const message = error.message.toLowerCase();
    const code = error.code?.toLowerCase() ?? "";

    if (error.status === 401 || code.includes("invalid_client") || message.includes("authorization header")) {
      return "oauth-client-secret-invalid";
    }
    if (message.includes("redirect")) {
      return "oauth-redirect-mismatch";
    }
    if (message.includes("expired") || message.includes("authorization code")) {
      return "oauth-code-expired";
    }
    return "oauth-token-failed";
  }

  const message = String((error as Error | null)?.message ?? error).toLowerCase();
  if (message.includes("missing_x_client_id")) return "oauth-client-missing";
  if (message.includes("x_me_")) return "oauth-profile-failed";
  if (message.includes("database") || message.includes("relation") || message.includes("garage_x_accounts")) {
    return "oauth-save-failed";
  }
  return "oauth-failed";
}

function describeOAuthError(error: unknown) {
  if (error instanceof XOAuthError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
    };
  }
  return { message: (error as Error | null)?.message ?? String(error) };
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-x-oauth-callback", 60, 60_000);
  if (limited) return limited;

  const state = req.nextUrl.searchParams.get("state");
  const signedPending = readSignedXOAuthState(state);
  const cookiePending = readPending(req);
  const pending = signedPending ?? (cookiePending?.state === state ? cookiePending : null);
  if (!pending) return redirectTo(req, "/garage", "oauth-state-missing");

  const error = req.nextUrl.searchParams.get("error");
  if (error) return redirectTo(req, pending.returnTo, "oauth-cancelled");

  const code = req.nextUrl.searchParams.get("code");
  if (!state || state !== pending.state || !code) {
    return redirectTo(req, pending.returnTo, "oauth-state-invalid");
  }

  const sessionAddress = await getAuthenticatedAddress(req).catch(() => null);
  if (!signedPending && (!sessionAddress || sessionAddress.toLowerCase() !== pending.address.toLowerCase())) {
    return redirectTo(req, pending.returnTo, "wallet-session-lost");
  }
  const address = pending.address.toLowerCase();

  try {
    const accessToken = await exchangeCode(req, code, pending.codeVerifier);
    const me = await fetchXMe(accessToken);

    const [existingX] = await db
      .select({ walletAddress: garageXAccounts.walletAddress })
      .from(garageXAccounts)
      .where(eq(garageXAccounts.xUserId, me.id))
      .limit(1);

    if (existingX && existingX.walletAddress.toLowerCase() !== address.toLowerCase()) {
      return redirectTo(req, pending.returnTo, "x-already-linked");
    }

    await db
      .insert(garageXAccounts)
      .values({
        walletAddress: address.toLowerCase(),
        xUserId: me.id,
        username: me.username,
        displayName: me.name,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: garageXAccounts.walletAddress,
        set: {
          xUserId: me.id,
          username: me.username,
          displayName: me.name,
          updatedAt: new Date(),
        },
      });

    return redirectAfterOAuth(req, pending, "linked");
  } catch (error: any) {
    const status = classifyOAuthError(error);
    console.error("[garage/x/connect/callback] error:", { status, ...describeOAuthError(error) });
    return redirectTo(req, pending.returnTo, status);
  }
}
