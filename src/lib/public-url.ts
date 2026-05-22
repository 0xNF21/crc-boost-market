const DEFAULT_CRC_BOOST_APP_URL = "https://crc-boost-market.vercel.app";

function normalizePublicOrigin(value: string | undefined) {
  if (!value) return DEFAULT_CRC_BOOST_APP_URL;

  try {
    return new URL(value).origin;
  } catch {
    return DEFAULT_CRC_BOOST_APP_URL;
  }
}

export function getCrcBoostPublicUrl() {
  return normalizePublicOrigin(process.env.NEXT_PUBLIC_CRC_BOOST_APP_URL);
}

