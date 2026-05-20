import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Space_Grotesk, Sora } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { MiniAppProvider } from "@/components/miniapp-provider";
import { AuthProvider } from "@/components/auth-provider";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Sora({
  subsets: ["latin"],
  variable: "--font-body",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crc-boost-market.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "CRC Boost Market by NF Society",
  description: "A Circles-native attention market where creators fund CRC rewards for verified X actions.",
  openGraph: {
    title: "CRC Boost Market",
    description: "Creators fund CRC rewards for verified X attention. Users earn CRC after settlement.",
    url: appUrl,
    siteName: "CRC Boost Market",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CRC Boost Market",
    description: "Creators fund CRC rewards for verified X attention. Users earn CRC after settlement.",
  },
  icons: {
    icon: "/nf-society-logo.png",
    apple: "/nf-society-logo.png",
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
