import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme/theme-provider";

import "./globals.css";

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
    default: "Wordle Arena — Daily word games",
    template: "%s · Wordle Arena",
  },
  description:
    "Play Wordle Arena plus a growing collection of daily word games. New puzzles every day, free and no account required.",
  applicationName: "Wordle Arena",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    type: "website",
    siteName: "Wordle Arena",
    title: "Wordle Arena — Daily word games",
    description:
      "Daily word puzzles in one place. A fresh challenge every midnight IST, free and playable without an account.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wordle Arena — Daily word games",
    description: "Daily word puzzles in one place. Free, no account required.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="relative flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
