import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const space = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jbmono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "TrustMCP — Trust, guardrails & payments for AI agents",
  description:
    "A gate in front of any tool or API that decides which agents to trust — reputation, behavioral guardrails, and x402 payments in one layer.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${space.variable} ${jbmono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
