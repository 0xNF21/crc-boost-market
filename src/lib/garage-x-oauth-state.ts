import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export type PendingXOAuth = {
  state: string;
  codeVerifier: string;
  address: string;
  returnTo: string;
};

type SignedXOAuthPayload = {
  v: 1;
  nonce: string;
  codeVerifier: string;
  address: string;
  returnTo: string;
  exp: number;
};

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unbase64url(input: string) {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function getSigningSecret() {
  const secret =
    process.env.X_OAUTH_STATE_SECRET ||
    process.env.X_CLIENT_SECRET ||
    process.env.TWITTER_CLIENT_SECRET ||
    process.env.DATABASE_URL ||
    process.env.X_CLIENT_ID;

  if (!secret) throw new Error("missing_x_oauth_state_secret");
  return secret;
}

function sign(payload: string) {
  return base64url(createHmac("sha256", getSigningSecret()).update(payload).digest());
}

export function createSignedXOAuthState(params: {
  codeVerifier: string;
  address: string;
  returnTo: string;
  maxAgeSeconds?: number;
}) {
  const payload: SignedXOAuthPayload = {
    v: 1,
    nonce: base64url(randomBytes(16)),
    codeVerifier: params.codeVerifier,
    address: params.address.toLowerCase(),
    returnTo: params.returnTo,
    exp: Math.floor(Date.now() / 1000) + (params.maxAgeSeconds ?? 10 * 60),
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function readSignedXOAuthState(state: string | null): PendingXOAuth | null {
  if (!state) return null;
  const [payloadPart, signaturePart] = state.split(".");
  if (!payloadPart || !signaturePart) return null;

  const expected = sign(payloadPart);
  const providedBuffer = Buffer.from(signaturePart);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(unbase64url(payloadPart).toString("utf8")) as SignedXOAuthPayload;
    if (payload.v !== 1 || !payload.codeVerifier || !payload.address || !payload.returnTo || !payload.exp) {
      return null;
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      state,
      codeVerifier: payload.codeVerifier,
      address: payload.address.toLowerCase(),
      returnTo: payload.returnTo.startsWith("/") && !payload.returnTo.startsWith("//") ? payload.returnTo : "/garage",
    };
  } catch {
    return null;
  }
}
