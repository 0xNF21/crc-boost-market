import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Space_Grotesk, Sora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { MiniAppProvider } from "@/components/miniapp-provider";
import { AuthProvider } from "@/components/auth-provider";
import { getCrcBoostPublicUrl } from "@/lib/public-url";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Sora({
  subsets: ["latin"],
  variable: "--font-body",
});

const appUrl = getCrcBoostPublicUrl();
const appName = "CRC Boosts by NF-Society";
const appDescription = "A Circles-native attention market where creators fund CRC rewards for verified X actions.";
const socialDescription = "Creators fund CRC rewards for verified X attention. Users earn CRC after settlement.";
const socialImage = "/crc-boost-preview.png";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: appName,
  title: appName,
  description: appDescription,
  alternates: {
    canonical: appUrl,
  },
  openGraph: {
    title: appName,
    description: socialDescription,
    url: appUrl,
    siteName: appName,
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: socialImage,
        width: 1672,
        height: 941,
        alt: "CRC Boosts attention market",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: socialDescription,
    images: [socialImage],
  },
  icons: {
    icon: "/crc-boost-icon.png",
    apple: "/crc-boost-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eee8df" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b1f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <LanguageProvider>
            <MiniAppProvider>
              <AuthProvider>{children}</AuthProvider>
            </MiniAppProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
