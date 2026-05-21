export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { requireAuthenticatedAddress } from "@/lib/auth/session";
import { GARAGE_X_SCOPES, isXOAuthConfigured } from "@/lib/garage-x";
import { createSignedXOAuthState } from "@/lib/garage-x-oauth-state";
import { enforceRateLimit } from "@/lib/rate-limit";

const OAUTH_COOKIE = "nfs_x_oauth";

function base64url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function getRedirectUri(req: NextRequest) {
  return process.env.X_REDIRECT_URI || `${req.nextUrl.origin}/api/garage/x/connect/callback`;
}

function getReturnTo(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get("returnTo") || "/garage";
  return returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/garage";
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "garage-x-oauth-start", 60, 60_000);
  if (limited) return limited;

  const wantsJson = req.nextUrl.searchParams.get("format") === "json";
  const redirectUri = getRedirectUri(req);
  const appOrigin = new URL(redirectUri).origin;
  const addressOr401 = await requireAuthenticatedAddress(req);
  if (addressOr401 instanceof NextResponse) {
    if (wantsJson) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    const redirect = new URL("/garage", appOrigin);
    redirect.searchParams.set("x", "connect-wallet-first");
    return NextResponse.redirect(redirect);
  }

  if (!isXOAuthConfigured()) {
    if (wantsJson) {
      return NextResponse.json({ error: "OAUTH_MISSING" }, { status: 503 });
    }
    const redirect = new URL("/garage", appOrigin);
    redirect.searchParams.set("x", "oauth-missing");
    return NextResponse.redirect(redirect);
  }

  const codeVerifier = base64url(randomBytes(48));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
  const returnTo = getReturnTo(req);
  const returnAfterAuth = req.nextUrl.searchParams.get("returnAfterAuth") === "playground" ? "playground" : undefined;
  const state = createSignedXOAuthState({
    codeVerifier,
    address: addressOr401,
    returnTo,
    returnAfterAuth,
  });

  const authUrl = new URL("https://x.com/i/oauth2/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", process.env.X_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", GARAGE_X_SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const res = wantsJson ? NextResponse.json({ authUrl: authUrl.toString() }) : NextResponse.redirect(authUrl);
  res.cookies.set({
    name: OAUTH_COOKIE,
    value: Buffer.from(
      JSON.stringify({
        state,
        codeVerifier,
        address: addressOr401.toLowerCase(),
        returnTo,
        returnAfterAuth,
      }),
    ).toString("base64url"),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return res;
}
