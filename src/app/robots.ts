import type { MetadataRoute } from "next";
import { getCrcBoostPublicUrl } from "@/lib/public-url";

export default function robots(): MetadataRoute.Robots {
  const base = getCrcBoostPublicUrl();
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${base}/sitemap.xml`,
  };
}
