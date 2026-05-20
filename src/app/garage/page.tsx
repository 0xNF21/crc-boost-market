import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import CirclesGaragePage from "@/components/circles-garage-page";

export const metadata: Metadata = {
  title: "CRC Boost Market by NF Society",
  description:
    "A Circles-native attention market where creators fund CRC rewards for verified X actions.",
};

function getGarageCanonicalOrigin() {
  const redirectUri = process.env.X_REDIRECT_URI;
  if (!redirectUri) return null;

  try {
    const origin = new URL(redirectUri).origin;
    return origin.includes("127.0.0.1") || origin.includes("localhost") ? origin : null;
  } catch {
    return null;
  }
}

export default function GaragePage() {
  const canonicalOrigin = getGarageCanonicalOrigin();
  const requestHeaders = headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";

  if (canonicalOrigin && host) {
    const requestOrigin = `${protocol}://${host}`;
    if (requestOrigin !== canonicalOrigin) {
      redirect(`${canonicalOrigin}/garage`);
    }
  }

  return <CirclesGaragePage />;
}
