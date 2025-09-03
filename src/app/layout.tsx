import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "prismjs/themes/prism-tomorrow.css";
import ClientShell from "./ClientShell";
import ClientAuthWrapper from "@/components/ClientAuthWrapper";

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
    icon: "/logo.webp",
    shortcut: "/logo.webp",
    apple: "/logo.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientAuthWrapper>
          {/* Client shell wraps header, sidebar and main */}
          <ClientShell>{children}</ClientShell>
        </ClientAuthWrapper>
      </body>
    </html>
  );
}
