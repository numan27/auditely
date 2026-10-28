import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/app/_shared/components/providers/ThemeProvider";
import { SiteAnalytics } from "@/app/_shared/components/providers/siteAnalytics";
import { AUDITELY_URL } from "@/app/_shared/lib/config/site";
import { SHARE_DESCRIPTION } from "@/app/_shared/lib/seo/shareCopy";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face: page titles and audit score numerals
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

// Nothing is indexed unless its page says so: the landing, signup, login, Terms and Privacy do
export const metadata: Metadata = {
  title: { default: "Auditely", template: "%s | Auditely" },
  description:
    "Audit any website in about a minute: speed, SEO, mobile, SSL and AI-search readiness, explained in plain English.",
  metadataBase: new URL(AUDITELY_URL),
  // A shared link shows the site's name and app/opengraph-image.tsx as a large card;
  // the home page gives its own title (app/(app)/page.tsx)
  openGraph: { type: "website", siteName: "Auditely", title: "Auditely", description: SHARE_DESCRIPTION },
  twitter: { card: "summary_large_image" },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} antialiased min-h-screen`}
      >
        {/* The redux store lives with the template's dashboard, its only user: its
            PersistGate rendered nothing until the browser restored it, so every
            page arrived empty (app/(pages)/(dashboard)/layout.tsx) */}
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <SiteAnalytics />
      </body>
    </html>
  );
}
