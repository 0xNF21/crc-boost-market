import type { MetadataRoute } from "next";
import { getCrcBoostPublicUrl } from "@/lib/public-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getCrcBoostPublicUrl();
  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/garage`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  ];
}
