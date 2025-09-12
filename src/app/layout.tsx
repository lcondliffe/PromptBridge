import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "prismjs/themes/prism-tomorrow.css";
import ClientShell from "./ClientShell";
import ClientAuthWrapper from "@/components/ClientAuthWrapper";
import PHProvider from "@/components/PostHogProvider";
import { PostHogIdentifier } from "@/components/PostHogIdentifier";
import PostHogPageView from "@/components/PostHogPageView";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PromptBridge",
  description: "Prompt multiple LLMs and synthesize a consensus via OpenRouter",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PHProvider>
          <ClientAuthWrapper>
            <PostHogIdentifier />
            <Suspense fallback={null}>
              <PostHogPageView />
            </Suspense>
            {/* Client shell wraps header, sidebar and main */}
            <ClientShell>{children}</ClientShell>
          </ClientAuthWrapper>
        </PHProvider>
      </body>
    </html>
  );
}
