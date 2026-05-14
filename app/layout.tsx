import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/app/_shared/components/providers/ThemeProvider";
import { StoreProvider } from "@/app/_shared/components/providers/StoreProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Next.js Template",
    default: "Next.js Template - Production Ready Starter",
  },
  description: "A production-ready Next.js template with authentication, form validation, theming, and scalable architecture.",
  keywords: ["next.js", "template", "react", "typescript", "tailwindcss"],
  authors: [{ name: "Next.js Template" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Next.js Template",
    description: "A production-ready Next.js template with authentication, form validation, theming, and scalable architecture.",
    siteName: "Next.js Template",
  },
  twitter: {
    card: "summary_large_image",
    title: "Next.js Template",
    description: "A production-ready Next.js template with authentication, form validation, theming, and scalable architecture.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <StoreProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
